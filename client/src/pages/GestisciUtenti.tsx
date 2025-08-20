import React, { useState, useMemo } from "react";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Search, Trash2, AlertCircle, Edit, Users, UserCheck, UserX, Shield, Mail, Calendar } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EditUserDialog } from "@/components/EditUserDialog";
import { EditOpinioniDialog } from "@/components/EditOpinioniDialog";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth-neon";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

type User = {
  id: string;
  uid: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  status: 'pending' | 'active' | 'rejected';
  // Aggiungo tutte le altre colonne possibili
  [key: string]: any; // Per permettere colonne dinamiche
};

// Colonne delle opinioni da escludere
const OPINION_COLUMNS = [
  'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
  'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
  'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia'
];

// Funzione per ottenere le colonne da mostrare
const getDisplayColumns = (users: any[]) => {
  if (!users || users.length === 0) return [];
  
  const firstUser = users[0];
  const allColumns = Object.keys(firstUser);
  
  // Filtra le colonne delle opinioni
  const displayColumns = allColumns.filter(col => !OPINION_COLUMNS.includes(col));
  
  // Ordina le colonne in modo logico
  const priorityColumns = ['id', 'nome', 'cognome', 'email', 'ruolo', 'status'];
  const sortedColumns = [
    ...priorityColumns.filter(col => displayColumns.includes(col)),
    ...displayColumns.filter(col => !priorityColumns.includes(col))
  ];
  
  return sortedColumns;
};

// Funzione per formattare il valore di una colonna
const formatColumnValue = (value: any, columnName: string) => {
  if (value === null || value === undefined) return '-';
  
  // Formatta date
  if (columnName.includes('_at') || columnName.includes('data_')) {
    try {
      return new Date(value).toLocaleDateString('it-IT');
    } catch {
      return value;
    }
  }
  
  // Formatta booleani
  if (typeof value === 'boolean') {
    return value ? 'Sì' : 'No';
  }
  
  // Formatta JSON
  if (typeof value === 'object') {
    return JSON.stringify(value).substring(0, 50) + (JSON.stringify(value).length > 50 ? '...' : '');
  }
  
  return String(value);
};

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
  const [sortField, setSortField] = useState<keyof User>('nome');
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
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
    // Correggo la condizione - uso user.role che è 'Admin'
    enabled: !!user && user.role === 'Admin',
  });

  // Estrai i dati con fallback sicuro e logging per debug
  const utenti = responseData?.utenti?.data || responseData?.utenti || [];
  const pendingUsers = responseData?.pendingUsers || [];
  
  // Debug logging
  console.log('🔍 DEBUG GestisciUtenti:', {
    responseData,
    utenti: Array.isArray(utenti) ? `${utenti.length} utenti` : `Non array: ${typeof utenti}`,
    pendingUsers: Array.isArray(pendingUsers) ? `${pendingUsers.length} pending` : `Non array: ${typeof pendingUsers}`
  });

  // Debug logging per vedere tutte le colonne disponibili
  console.log('🔍 DEBUG GestisciUtenti - Colonne disponibili:', {
    firstUser: utenti?.[0] ? Object.keys(utenti[0]) : 'Nessun utente',
    totalUsers: utenti?.length || 0
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
    // Protezione aggiuntiva: assicurati che utenti sia un array
    if (!Array.isArray(utenti)) {
      console.warn('⚠️ utenti non è un array:', utenti);
      return [];
    }
    
    return utenti
      .filter(u => {
        // Ricerca su tutte le colonne di testo
        const searchLower = searchTerm.toLowerCase();
        return displayColumns.some(col => {
          const value = u[col];
          if (typeof value === 'string') {
            return value.toLowerCase().includes(searchLower);
          }
          return false;
        });
      })
      .sort((a, b) => {
        if (!sortField) return 0;
        const valA = a[sortField];
        const valB = b[sortField];
        if (valA < valB) return sortDirection === "asc" ? -1 : 1;
        if (valA > valB) return sortDirection === "asc" ? 1 : -1;
        return 0;
      });
  }, [utenti, searchTerm, sortField, sortDirection, displayColumns]);

  const totalPages = Math.ceil(filteredAndSortedUsers.length / usersPerPage);
  const paginatedUsers = filteredAndSortedUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      setSortDirection(prev => prev === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("asc");
    }
  };

  if (isAuthLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }
  if (!user) {
    return <Redirect to="/auth" />;
  }
  
  // Controllo più flessibile per il ruolo admin
  const isAdmin = user.role === 'Admin' || (user as any).ruolo === 'Admin';
  console.log('🔍 DEBUG GestisciUtenti - Admin check:', { isAdmin, userRole: user.role, userRuolo: (user as any).ruolo });
  
  if (!isAdmin) {
    console.log('🔍 DEBUG GestisciUtenti - Redirecting to menu: user is not admin');
    return <Redirect to="/menu" />;
  }
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4">
             <div className="w-full px-6">
        {/* Header moderno con gradiente */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center mb-4">
            <Link href="/menu">
              <Button variant="ghost" className="mr-4 hover:bg-white/50">
                <ArrowLeft className="h-5 w-5 mr-2" />Torna al Menu
              </Button>
            </Link>
            <div className="flex items-center space-x-3">
              <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full">
                <Users className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Gestione Utenti
              </h1>
            </div>
          </div>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Amministra gli utenti della piattaforma, gestisci ruoli e approva nuove registrazioni
          </p>
        </div>
        
        {isLoadingUsers ? (
            <div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : isError ? (
            <div className="text-center text-red-500 p-8">Errore nel caricamento degli utenti.</div>
        ) : (
          <>
                         {/* Dashboard statistiche - righe larghe tutto lo schermo */}
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-500 rounded-lg">
                      <Users className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-blue-600">Utenti Totali</p>
                      <p className="text-2xl font-bold text-blue-900">{utenti.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-500 rounded-lg">
                      <UserCheck className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-green-600">Utenti Attivi</p>
                      <p className="text-2xl font-bold text-green-900">{utenti.filter(u => u.status === 'active').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-yellow-50 to-yellow-100 border-yellow-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-yellow-500 rounded-lg">
                      <AlertCircle className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-yellow-600">In Attesa</p>
                      <p className="text-2xl font-bold text-yellow-900">{pendingUsers.length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
              
              <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-500 rounded-lg">
                      <Shield className="h-5 w-5 text-white" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-purple-600">Admin</p>
                      <p className="text-2xl font-bold text-purple-900">{utenti.filter(u => u.ruolo === 'Admin').length}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {pendingUsers.length > 0 && (
                <Card className="mb-8 border-0 bg-gradient-to-r from-yellow-50 to-orange-50 shadow-lg">
                    <CardHeader className="pb-4">
                        <CardTitle className="text-2xl font-bold text-yellow-700 flex items-center">
                            <div className="p-2 bg-yellow-500 rounded-lg mr-3">
                                <AlertCircle className="h-6 w-6 text-white" />
                            </div>
                            Richieste di Approvazione ({pendingUsers.length})
                        </CardTitle>
                        <CardDescription className="text-yellow-600 text-lg">
                            ⚠️ Questi utenti attendono la tua approvazione per accedere alla piattaforma
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                                                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {pendingUsers.map((pendingUser: any) => (
                                <Card key={pendingUser.id} className="border-yellow-200 bg-white/80 hover:shadow-md transition-all duration-200">
                                    <CardContent className="p-4">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h3 className="font-semibold text-gray-900 mb-1">
                                                    <Link href={`/menu/profilo/${pendingUser.uid || pendingUser.id}?from=utenti`} className="cursor-pointer text-blue-600 hover:underline">
                                                        {pendingUser.nome} {pendingUser.cognome}
                                                    </Link>
                                                </h3>
                                                <div className="flex items-center space-x-2 text-sm text-gray-600 mb-2">
                                                    <Mail className="h-4 w-4" />
                                                    <span>{pendingUser.email}</span>
                                                </div>
                                                <div className="flex items-center space-x-2 text-sm text-gray-600">
                                                    <Shield className="h-4 w-4" />
                                                    <span className="capitalize">{pendingUser.ruolo}</span>
                                                </div>
                                            </div>
                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded-full">
                                                In Attesa
                                            </span>
                                        </div>
                                        <div className="flex space-x-2 pt-3 border-t border-yellow-100">
                                            <Button 
                                                size="sm" 
                                                variant="outline" 
                                                className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" 
                                                onClick={() => approvalMutation.mutate({ userId: pendingUser.id, approve: false })} 
                                                disabled={approvalMutation.isPending}
                                            >
                                                Rifiuta
                                            </Button>
                                            <Button 
                                                size="sm" 
                                                className="bg-green-500 hover:bg-green-600" 
                                                onClick={() => approvalMutation.mutate({ userId: pendingUser.id, approve: true })} 
                                                disabled={approvalMutation.isPending}
                                            >
                                                Approva
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Sezione utenti attivi con layout moderno */}
            <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center text-2xl text-gray-800">
                  <Users className="h-6 w-6 mr-3 text-blue-600" />
                  Utenti Attivi
                </CardTitle>
                <CardDescription className="text-gray-600">
                  Visualizza e gestisci tutti gli utenti della piattaforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                {/* Barra di ricerca migliorata */}
                                 <div className="flex items-center mb-6">
                   <div className="relative flex-1 max-w-2xl">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input 
                      placeholder="🔍 Cerca utenti per nome, email o ruolo..." 
                      className="pl-10 pr-4 py-2 border-2 border-gray-200 focus:border-blue-500 rounded-lg transition-colors" 
                      value={searchTerm} 
                      onChange={(e) => setSearchTerm(e.target.value)} 
                    />
                  </div>
                  <div className="ml-4 text-sm text-gray-500">
                    {filteredAndSortedUsers.length} utenti trovati
                  </div>
                </div>

                {/* Layout a schede per gli utenti */}
                {paginatedUsers.length > 0 ? (
                                     <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
                    {paginatedUsers.map((u: any) => (
                      <Card key={u.id} className="group hover:shadow-xl transition-all duration-300 border-0 bg-gradient-to-br from-white to-gray-50 hover:from-blue-50 hover:to-blue-100">
                        <CardContent className="p-6">
                          {/* Header con nome e ruolo */}
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex-1">
                              <h3 className="text-lg font-semibold text-gray-900 mb-1">
                                <Link href={`/menu/profilo/${u.uid || u.id}?from=utenti`} className="cursor-pointer text-blue-600 hover:underline">
                                  {u.nome} {u.cognome}
                                </Link>
                              </h3>
                              <p className="text-sm text-gray-600">{u.email}</p>
                            </div>
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              u.ruolo === 'Admin' 
                                ? 'bg-purple-100 text-purple-800 border border-purple-200' 
                                : u.ruolo === 'Candidato Politico'
                                ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                : u.ruolo === 'Politico'
                                ? 'bg-green-100 text-green-800 border border-green-200'
                                : 'bg-gray-100 text-gray-800 border border-gray-200'
                            }`}>
                              {u.ruolo}
                            </span>
                          </div>
                          
                          {/* Dettagli utente */}
                          <div className="space-y-2 mb-4">
                            <div className="flex items-center space-x-2 text-sm text-gray-600">
                              <Shield className="h-4 w-4 text-blue-500" />
                              <span>ID: {u.id.substring(0, 8)}...</span>
                            </div>
                            {u.status && (
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <div className={`w-2 h-2 rounded-full ${
                                  u.status === 'active' ? 'bg-green-500' : 
                                  u.status === 'pending' ? 'bg-yellow-500' : 'bg-red-500'
                                }`} />
                                <span className="capitalize">{u.status}</span>
                              </div>
                            )}
                            {u.createdAt && (
                              <div className="flex items-center space-x-2 text-sm text-gray-600">
                                <Calendar className="h-4 w-4 text-purple-500" />
                                <span>Registrato: {new Date(u.createdAt).toLocaleDateString('it-IT')}</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Azioni */}
                          <div className="flex space-x-2 pt-3 border-t border-gray-100">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => { setSelectedUser(u); setShowEditDialog(true); }}
                              className="flex-1 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                            >
                              <Edit className="h-4 w-4 mr-2" />
                              Modifica
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => { setSelectedUser(u); setShowEditOpinioniDialog(true); }}
                              className="flex-1 hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors"
                            >
                              📝 Opinioni
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={() => setUserToDelete(u)}
                              className="flex-1 hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Elimina
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun utente trovato</h3>
                    <p className="text-gray-500">Prova a modificare i criteri di ricerca</p>
                  </div>
                )}

                {/* Paginazione migliorata */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center gap-3 mt-8">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setCurrentPage(p => Math.max(1, p - 1))} 
                      disabled={currentPage === 1}
                      className="px-4 py-2"
                    >
                      ← Precedente
                    </Button>
                    <div className="flex items-center space-x-2">
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                        <Button
                          key={page}
                          size="sm"
                          variant={currentPage === page ? "default" : "outline"}
                          onClick={() => setCurrentPage(page)}
                          className="w-10 h-10"
                        >
                          {page}
                        </Button>
                      ))}
                    </div>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} 
                      disabled={currentPage === totalPages}
                      className="px-4 py-2"
                    >
                      Successiva →
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        <AlertDialog open={!!userToDelete} onOpenChange={(open) => !open && setUserToDelete(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle className="flex items-center"><AlertCircle className="h-5 w-5 text-red-500 mr-2" />Conferma eliminazione</AlertDialogTitle>
                    <AlertDialogDescription>Sei sicuro di voler eliminare l'utente <strong>{userToDelete?.nome} {userToDelete?.cognome}</strong>? L'operazione non è reversibile.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Annulla</AlertDialogCancel>
                    <AlertDialogAction onClick={() => userToDelete && deleteMutation.mutate(userToDelete.uid)} className="bg-red-500 hover:bg-red-600 text-white" disabled={deleteMutation.isPending}>
                        {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : "Elimina"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {selectedUser && (
            <>
                <EditUserDialog userUid={selectedUser.uid} open={showEditDialog} onOpenChange={setShowEditDialog} onUserUpdated={() => queryClient.invalidateQueries({ queryKey: ['allUsers'] })} />
                <EditOpinioniDialog utenteId={selectedUser.uid} open={showEditOpinioniDialog} onOpenChange={setShowEditOpinioniDialog} />
            </>
        )}
      </div>
    </div>
  );
}