import React, { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { EditUserDialog } from "@/components/EditUserDialog";
import { EditOpinioniDialog } from "@/components/EditOpinioniDialog";
import { Loader2, Users, AlertCircle } from "lucide-react";
import { useUsers } from "./hooks/useUsers";
import { useUserManagement } from "./hooks/useUserManagement";
import { getDisplayColumns } from "./utils/columnUtils";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { UsersTable } from "./components/UsersTable";
import { MobileUsersTable } from "./components/MobileUsersTable";
import { MobilePendingUsersTable } from "./components/MobilePendingUsersTable";
import { PendingUsersTable } from "./components/PendingUsersTable";
import { usePendingUserActions } from "./hooks/usePendingUserActions";
import { Pagination } from "./components/Pagination";
import { USERS_PER_PAGE } from "./constants";
import { User } from "./types";
import { apiRequest } from "@/lib/queryClient";

export default function GestisciUtenti() {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  
  const {
    responseData,
    isLoadingUsers,
    isError,
    deleteMutation,
    queryClient
  } = useUsers(user);

  const {
    searchTerm,
    setSearchTerm,
    userToDelete,
    setUserToDelete,
    showEditDialog,
    setShowEditDialog,
    showEditOpinioniDialog,
    setShowEditOpinioniDialog,
    selectedUser,
    setSelectedUser,
    sortState,
    paginationState,
    lastUpdateTime,
    updateSort,
    resetPagination,
    updateLastUpdateTime,
    setCurrentPage
  } = useUserManagement();

  // Hook per le azioni sugli utenti pending
  const {
    approveUser,
    rejectUser,
    isProcessing
  } = usePendingUserActions();

  // Stato per gestire le modifiche inline
  const [userChanges, setUserChanges] = useState<Record<string, { grado_elezione?: string | null; grado_candidatura?: string | null }>>({});
  const [hasChanges, setHasChanges] = useState(false);
  
  // Hook per rilevare se siamo su mobile
  const [isMobile, setIsMobile] = useState(false);
  
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768); // md breakpoint
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Debug logging per capire il ruolo dell'utente
  useEffect(() => {
    console.log('🔍 DEBUG GestisciUtenti - Auth state:', {
      user: user ? { id: user.id, email: user.email, role: user.role, ruolo: (user as any).ruolo } : null,
      isAuthLoading,
      userRole: user?.role,
      userRuolo: (user as any)?.ruolo,
      isAdmin: user?.role === 'Admin' || (user as any)?.ruolo === 'Admin'
    });
  }, [user, isAuthLoading]);

  // Hook per forzare il refresh quando la pagina diventa visibile
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user?.ruolo === 'Admin') {
        console.log('🔄 Pagina diventata visibile, forzando refresh dati...');
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        updateLastUpdateTime();
      }
    };

    const handleFocus = () => {
      if (user?.ruolo === 'Admin') {
        console.log('🔄 Finestra riprende focus, forzando refresh dati...');
        queryClient.invalidateQueries({ queryKey: ['allUsers'] });
        updateLastUpdateTime();
      }
    };

    // Aggiungi event listeners
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    // Cleanup
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [user, queryClient, updateLastUpdateTime]);

  // Controllo accesso
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-lg text-gray-600">Caricamento...</p>
        </div>
      </div>
    );
  }

  if (!user || (user.role !== 'Admin' && (user as any).ruolo !== 'Admin')) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-red-100 to-red-200 page-with-navbar flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-lg shadow-xl">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-red-700 mb-4">Accesso Negato</h2>
          <p className="text-lg text-gray-700">Non hai i permessi necessari per visualizzare questa pagina.</p>
          <p className="text-md text-gray-500 mt-2">Solo gli amministratori possono accedere.</p>
        </div>
      </div>
    );
  }

  // Preparazione dati
  const allUsers = responseData?.utenti || [];
  const pendingUsers = responseData?.pendingUsers || [];
  const displayColumns = getDisplayColumns(allUsers);

  // Filtraggio e ordinamento
  const filteredUsers = useMemo(() => {
    let filtered = allUsers.filter((u: any) => {
      // Mostra tutti gli utenti, non solo quelli con status "active"
      // (rimosso il filtro hardcoded per status)
      
      const searchLower = searchTerm.toLowerCase();
      return (
        u.nome?.toLowerCase().includes(searchLower) ||
        u.cognome?.toLowerCase().includes(searchLower) ||
        u.name?.toLowerCase().includes(searchLower) ||
        u.email?.toLowerCase().includes(searchLower) ||
        u.ruolo?.toLowerCase().includes(searchLower) ||
        `${u.nome} ${u.cognome}`.toLowerCase().includes(searchLower) ||
        u.nome_completo?.toLowerCase().includes(searchLower)
      );
    });

    // Ordinamento
    filtered.sort((a: any, b: any) => {
      const aValue = a[sortState.sortField];
      const bValue = b[sortState.sortField];
      
      if (aValue === null || aValue === undefined) return 1;
      if (bValue === null || bValue === undefined) return -1;
      
      const comparison = String(aValue).localeCompare(String(bValue), 'it');
      return sortState.sortDirection === 'asc' ? comparison : -comparison;
    });

    return filtered;
  }, [allUsers, searchTerm, sortState]);

  // Paginazione
  const totalPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const startIndex = (paginationState.currentPage - 1) * USERS_PER_PAGE;
  const paginatedUsers = filteredUsers.slice(startIndex, startIndex + USERS_PER_PAGE);

  // Aggiorna totalPages nel paginationState
  useEffect(() => {
    if (totalPages !== paginationState.totalPages) {
      // Reset alla prima pagina se il numero totale di pagine cambia
      if (paginationState.currentPage > totalPages) {
        setCurrentPage(1);
      }
    }
  }, [totalPages, paginationState.totalPages, paginationState.currentPage, setCurrentPage]);

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['allUsers'] });
    updateLastUpdateTime();
  };

  const handleEdit = (user: any) => {
    setSelectedUser(user);
    setShowEditDialog(true);
  };

  const handleEditOpinioni = (user: any) => {
    setSelectedUser(user);
    setShowEditOpinioniDialog(true);
  };

  const handleDelete = (user: any) => {
    setUserToDelete(user);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleApproveUser = (user: any) => {
    approveUser(user.id);
  };

  const handleRejectUser = (user: any) => {
    // Per ora rifiutiamo senza motivo, in futuro si può aggiungere un dialog per inserire il motivo
    rejectUser({ userId: user.id });
  };

  // Funzioni per gestire le modifiche inline
  const handleFieldChange = (userId: string, field: 'grado_elezione' | 'grado_candidatura', value: string | null) => {
    setUserChanges(prev => {
      const newChanges = {
        ...prev,
        [userId]: {
          ...prev[userId],
          [field]: value
        }
      };
      
      // Controlla se ci sono modifiche
      const hasAnyChanges = Object.values(newChanges).some(change => 
        change.grado_elezione !== undefined || change.grado_candidatura !== undefined
      );
      setHasChanges(hasAnyChanges);
      
      return newChanges;
    });
  };

  const handleSaveChanges = async () => {
    try {
      const updates = Object.entries(userChanges).map(([userId, changes]) => ({
        userId,
        ...changes
      }));

      for (const update of updates) {
        await apiRequest("PUT", `/api/users/${update.userId}`, update);
      }

      // Reset delle modifiche
      setUserChanges({});
      setHasChanges(false);
      
      // Refresh dei dati
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      
      toast({
        title: "Successo",
        description: "Modifiche salvate con successo!",
      });
    } catch (error) {
      console.error('Errore nel salvataggio:', error);
      toast({
        title: "Errore",
        description: "Errore nel salvataggio delle modifiche",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 page-with-navbar" style={{ paddingBottom: '6rem' }}>
      <div className="container mx-auto max-w-full px-4 py-4 md:px-6 md:py-6">
        {/* Header */}
        <Header 
          lastUpdateTime={lastUpdateTime}
          onRefresh={handleRefresh}
          isLoading={isLoadingUsers}
        />

        {/* Barra di ricerca */}
        <SearchBar 
          searchTerm={searchTerm}
          onSearchChange={(value) => {
            setSearchTerm(value);
            resetPagination();
          }}
        />

        {/* Contenuto principale */}
        {isLoadingUsers ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
            <span className="ml-3 text-lg text-gray-600">Caricamento utenti...</span>
          </div>
        ) : isError ? (
          <div className="text-center py-8 md:py-12 px-4">
            <AlertCircle className="h-12 w-12 md:h-16 md:w-16 text-red-500 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-red-900 mb-2">Errore nel caricamento</h3>
            <p className="text-red-600 mb-4">Impossibile caricare gli utenti. Riprova più tardi.</p>
            <Button 
              onClick={handleRefresh}
              variant="outline"
              className="bg-red-50 border-red-200 text-red-700 hover:bg-red-100"
            >
              Riprova
            </Button>
          </div>
        ) : (
          <>
        {/* Statistiche */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6 mb-6 md:mb-8">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-600">Totale Utenti</p>
                      <p className="text-2xl font-bold text-blue-900">{allUsers.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-600">Tutti gli Utenti</p>
                      <p className="text-2xl font-bold text-green-900">{allUsers.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-yellow-500 rounded-lg">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-yellow-600">In Attesa</p>
                      <p className="text-2xl font-bold text-yellow-900">{pendingUsers.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sezione Utenti in Attesa */}
            {pendingUsers.length > 0 && (
              <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg mb-6 w-full">
                <CardHeader className="pb-4">
                  <CardTitle className="flex items-center text-2xl text-gray-800">
                    <Users className="h-6 w-6 mr-3 text-yellow-600" />
                    Utenti in Attesa
                  </CardTitle>
                  <CardDescription className="text-gray-600">
                    Utenti in attesa di approvazione ({pendingUsers.length})
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isMobile ? (
                    <MobilePendingUsersTable 
                      users={pendingUsers}
                      onApprove={handleApproveUser}
                      onReject={handleRejectUser}
                      isProcessing={isProcessing}
                    />
                  ) : (
                    <PendingUsersTable 
                      users={pendingUsers}
                      onApprove={handleApproveUser}
                      onReject={handleRejectUser}
                      isProcessing={isProcessing}
                    />
                  )}
                </CardContent>
              </Card>
            )}

            {/* Tabella utenti attivi */}
            <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg w-full">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center text-2xl text-gray-800">
                      <Users className="h-6 w-6 mr-3 text-blue-600" />
                      Tutti gli Utenti
                    </CardTitle>
                    <CardDescription className="text-gray-600">
                      Visualizza e gestisci tutti gli utenti della piattaforma (attivi, pending, ecc.)
                    </CardDescription>
                  </div>
                  <Button 
                    onClick={handleSaveChanges}
                    disabled={!hasChanges}
                    className="bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    Salva Modifiche
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                {isMobile ? (
                  <MobileUsersTable 
                    users={paginatedUsers}
                    onEdit={handleEdit}
                    onEditOpinioni={handleEditOpinioni}
                    onDelete={handleDelete}
                    userChanges={userChanges}
                    onFieldChange={handleFieldChange}
                  />
                ) : (
                  <UsersTable 
                    users={paginatedUsers}
                    displayColumns={displayColumns}
                    sortState={sortState}
                    onSort={updateSort}
                    onEdit={handleEdit}
                    onEditOpinioni={handleEditOpinioni}
                    onDelete={handleDelete}
                    userChanges={userChanges}
                    onFieldChange={handleFieldChange}
                  />
                )}
                
                {/* Paginazione */}
                <Pagination 
                  currentPage={paginationState.currentPage}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </CardContent>
            </Card>
          </>
        )}

        {/* Dialog di conferma eliminazione */}
        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center">
                <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
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

        {/* Dialog di modifica utente */}
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
              onOpinioniUpdated={() => queryClient.invalidateQueries({ queryKey: ['allUsers'] })} 
            />
          </>
        )}
      </div>
    </div>
  );
}
