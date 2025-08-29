import React, { useState, useMemo, useEffect } from "react";
import { Link, Redirect } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Users, UserCheck, UserX, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EditUserDialog } from "@/components/EditUserDialog";
import { EditOpinioniDialog } from "@/components/EditOpinioniDialog";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth-neon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  UserSearch, 
  UserTable, 
  UserPagination, 
  getDisplayColumns,
  User, 
  SortDirection 
} from "@/components/gestisci-utenti";

export default function GestisciUtenti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debug logging per capire il ruolo dell'utente
  console.log('🔍 DEBUG GestisciUtenti - Auth state:', {
    user: user ? { id: user.id, email: user.email, role: user.role, ruolo: (user as any).ruolo } : null,
    isAuthLoading,
    userRole: user?.role,
    userRuolo: (user as any)?.ruolo,
    isAdmin: user?.role === 'Admin' || (user as any)?.ruolo === 'Admin'
  });

  const [searchTerm, setSearchTerm] = useState("");
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showEditOpinioniDialog, setShowEditOpinioniDialog] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [sortField, setSortField] = useState<keyof User>('nome_completo');
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date>(new Date());
  const usersPerPage = 20;

  const { data: responseData, isLoading: isLoadingUsers, isError } = useQuery({
    queryKey: ['allUsers'],
    queryFn: async () => {
      const [allUsersResponse, pendingUsersResponse] = await Promise.all([
        apiRequest("GET", "/api/utenti"),
        apiRequest("GET", "/api/utenti/pending")
      ]);
      if (!allUsersResponse.ok || !pendingUsersResponse.ok) throw new Error("Errore nel caricamento degli utenti");
      const allUsersData = await allUsersResponse.json();
      const pendingUsersData = await pendingUsersResponse.json();
      return { utenti: allUsersData, pendingUsers: pendingUsersData };
    },
    enabled: !!user && user.ruolo === 'Admin',
    refetchOnWindowFocus: true,
    refetchOnMount: true,
    refetchOnReconnect: true,
    staleTime: 0,
    gcTime: 5 * 60 * 1000,
    refetchInterval: 30 * 1000,
    refetchIntervalInBackground: false
  });

  // Hook per forzare il refresh quando la pagina diventa visibile
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.ruolo === 'Admin') {
        console.log('🔄 Pagina diventata visibile, forzando refresh dati...');
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        setLastUpdateTime(new Date());
      }
    };

    const handleFocus = () => {
      if (user?.ruolo === 'Admin') {
        console.log('🔄 Finestra riprende focus, forzando refresh dati...');
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        setLastUpdateTime(new Date());
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [queryClient, user?.ruolo]);

  // Aggiorna il timestamp quando i dati cambiano
  useEffect(() => {
    if (responseData) {
      setLastUpdateTime(new Date());
    }
  }, [responseData]);

  // Estrai i dati con fallback sicuro e logging per debug
  const utenti = responseData?.utenti?.users || responseData?.utenti || [];
  const pendingUsers = responseData?.pendingUsers?.users || responseData?.pendingUsers || [];
  
  // Debug logging
  console.log('🔍 DEBUG GestisciUtenti:', {
    responseData,
    utenti: Array.isArray(utenti) ? `${utenti.length} utenti` : `Non array: ${typeof utenti}`,
    pendingUsers: Array.isArray(pendingUsers) ? `${pendingUsers.length} pending` : `Non array: ${typeof pendingUsers}`
  });

  const approvalMutation = useMutation({
    mutationFn: ({ userId, approve }: { userId: string, approve: boolean }) => {
        const endpoint = approve ? '/api/utenti/approve' : '/api/utenti/reject';
        return apiRequest('POST', endpoint, { userId });
    },
    onSuccess: (_, { approve }) => {
        toast({ title: `Utente ${approve ? 'approvato' : 'rifiutato'}`, description: "La lista utenti è stata aggiornata." });
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    },
    onError: (error: any) => toast({ title: 'Errore', description: error.message || 'Azione fallita.', variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
      mutationFn: (userUid: string) => apiRequest("DELETE", `/api/utenti/${userUid}`),
      onSuccess: () => {
          toast({ title: 'Utente eliminato', description: 'L\'utente è stato eliminato con successo.' });
          queryClient.invalidateQueries({ queryKey: ['allUsers'] });
          setUserToDelete(null);
      },
      onError: (error: any) => toast({ title: 'Errore', description: error.message || 'Eliminazione fallita.', variant: 'destructive' }),
  });

  // Ottieni le colonne da mostrare
  const displayColumns = getDisplayColumns(utenti);
  
  const filteredAndSortedUsers = useMemo(() => {
    if (!Array.isArray(utenti)) {
      console.warn('⚠️ utenti non è un array:', utenti);
      return [];
    }
    
    return utenti
             .filter(u => {
         // Gestione filtri rapidi
         if (searchTerm === 'candidato:attivo') {
           return u.candidato_attivo === true;
         }
         if (searchTerm === 'elezione:comune') {
           return u.grado_elezione === 'comune' || u.grado_candidatura === 'comune';
         }
         if (searchTerm === 'elezione:regionale') {
           return u.grado_elezione === 'regionale' || u.grado_candidatura === 'regionale';
         }
         if (searchTerm === 'elezione:nazionale') {
           return u.grado_elezione === 'nazionale' || u.grado_candidatura === 'nazionale';
         }
         
         // Ricerca generica
         if (searchTerm && searchTerm !== 'candidato:attivo' && searchTerm !== 'elezione:comune' && searchTerm !== 'elezione:regionale' && searchTerm !== 'elezione:nazionale') {
           const searchLower = searchTerm.toLowerCase();
           return Object.values(u).some(value => 
             String(value).toLowerCase().includes(searchLower)
           );
         }
         
         return true;
       })
       .sort((a, b) => {
         const aValue = a[sortField];
         const bValue = b[sortField];
         
         if (aValue === null || aValue === undefined) return 1;
         if (bValue === null || bValue === undefined) return -1;
         
         if (typeof aValue === 'string' && typeof bValue === 'string') {
           return sortDirection === 'asc' 
             ? aValue.localeCompare(bValue, 'it-IT')
             : bValue.localeCompare(aValue, 'it-IT');
         }
         
         if (typeof aValue === 'number' && typeof bValue === 'number') {
           return sortDirection === 'asc' ? aValue - bValue : bValue - aValue;
         }
         
         if (typeof aValue === 'boolean' && typeof bValue === 'boolean') {
           return sortDirection === 'asc' ? (aValue === bValue ? 0 : aValue ? -1 : 1) : (aValue === bValue ? 0 : aValue ? 1 : -1);
         }
         
         return 0;
       });
  }, [utenti, searchTerm, sortField, sortDirection]);

  // Paginazione
  const totalPages = Math.ceil(filteredAndSortedUsers.length / usersPerPage);
  const startIndex = (currentPage - 1) * usersPerPage;
  const paginatedUsers = filteredAndSortedUsers.slice(startIndex, startIndex + usersPerPage);

  // Reset alla prima pagina quando cambia la ricerca
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    setLastUpdateTime(new Date());
  };

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setShowEditDialog(true);
  };

  const handleEditOpinioni = (user: User) => {
    setSelectedUser(user);
    setShowEditOpinioniDialog(true);
  };

  const handleDeleteUser = (user: User) => {
    setUserToDelete(user);
  };

  // Redirect se non è admin
  if (!isAuthLoading && (!user || user.ruolo !== 'Admin')) {
    return <Redirect to="/menu" />;
  }

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <Link href="/menu">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Torna al Menu
              </Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Gestione Utenti</h1>
              <p className="text-gray-600">Amministra tutti gli utenti della piattaforma</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-2xl font-bold text-blue-600">{utenti.length}</div>
              <div className="text-sm text-gray-500">Utenti Totali</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-yellow-600">{pendingUsers.length}</div>
              <div className="text-sm text-gray-500">In Attesa</div>
            </div>
          </div>
        </div>

        {/* Contenuto principale */}
        {isError ? (
          <Card className="bg-red-50 border-red-200">
            <CardContent className="pt-6">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-red-800 mb-2">Errore nel caricamento</h3>
                <p className="text-red-600">Impossibile caricare la lista utenti. Riprova più tardi.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Barra di ricerca e aggiornamento */}
            <Card className="mb-6">
              <CardContent className="pt-6">
                <UserSearch
                  searchTerm={searchTerm}
                  onSearchChange={setSearchTerm}
                  onRefresh={handleRefresh}
                  lastUpdateTime={lastUpdateTime}
                  isLoading={isLoadingUsers}
                />
              </CardContent>
            </Card>

            {/* Tabella utenti */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="h-5 w-5 mr-2" />
                  Lista Utenti
                </CardTitle>
                <CardDescription>
                  {filteredAndSortedUsers.length} utenti trovati
                  {searchTerm && ` per "${searchTerm}"`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {isLoadingUsers ? (
                  <div className="text-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                    <p>Caricamento utenti...</p>
                  </div>
                ) : (
                  <>
                    <UserTable
                      users={paginatedUsers}
                      displayColumns={displayColumns}
                      onEditUser={handleEditUser}
                      onEditOpinioni={handleEditOpinioni}
                      onDeleteUser={handleDeleteUser}
                      sortField={sortField}
                      sortDirection={sortDirection}
                      onSort={handleSort}
                    />
                    
                    <UserPagination
                      currentPage={currentPage}
                      totalPages={totalPages}
                      onPageChange={setCurrentPage}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {/* Dialog di conferma eliminazione */}
        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <Shield className="h-5 w-5 text-red-500 mr-2" />
                Conferma eliminazione
              </AlertDialogTitle>
              <AlertDialogDescription>
                Sei sicuro di voler eliminare l'utente <strong>{userToDelete?.nome} {userToDelete?.cognome}</strong>? 
                L'operazione non è reversibile.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Annulla</AlertDialogCancel>
              <AlertDialogAction 
                onClick={() => userToDelete && deleteMutation.mutate(userToDelete.id)} 
                className="bg-red-500 hover:bg-red-600 text-white" 
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : "Elimina"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Dialog di modifica utente e opinioni */}
        {selectedUser && (
          <>
            <EditUserDialog 
              userUid={selectedUser.id} 
              open={showEditDialog} 
              onOpenChange={setShowEditDialog} 
              onUserUpdated={() => queryClient.invalidateQueries({ queryKey: ['allUsers'] })} 
            />
            <EditOpinioniDialog 
              utenteId={selectedUser.id} 
              open={showEditOpinioniDialog} 
              onOpenChange={setShowEditOpinioniDialog} 
            />
          </>
        )}
      </div>
    </div>
  );
}
