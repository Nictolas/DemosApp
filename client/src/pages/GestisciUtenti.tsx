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
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  status: 'pending' | 'active' | 'rejected';
  // Aggiungo tutte le altre colonne possibili
  [key: string]: any; // Per permettere colonne dinamiche
};

// Colonne da escludere dalla visualizzazione
const HIDDEN_COLUMNS = [
  // Colonne delle opinioni
  'energia_nucleare', 'sperimentazione_animale', 'legalizzazione_canapa',
  'caccia', 'cittadina_animale', 'nato', 'matrimonio_gay', 'salario_minimo',
  'carne_coltivata', 'case_chiuse', 'eutanasia', 'omobitransfobia',
  // Colonne specifiche da nascondere
  'id', 'nome', 'cognome', 'password_hash', 'avatar_config', 'fonti_opinioni', 'firestore_uid'
];

// Funzione per ottenere le colonne da mostrare
const getDisplayColumns = (users: any[]) => {
  if (!users || users.length === 0) return [];
  
  const firstUser = users[0];
  const allColumns = Object.keys(firstUser);
  
  // Filtra le colonne nascoste
  const displayColumns = allColumns.filter(col => !HIDDEN_COLUMNS.includes(col));
  
  // Aggiungi colonna "Nome Completo" all'inizio
  const columnsWithFullName = ['nome_completo', ...displayColumns];
  
  // Ordina le colonne in modo logico
  const priorityColumns = ['nome_completo', 'email', 'ruolo', 'status'];
  const sortedColumns = [
    ...priorityColumns.filter(col => columnsWithFullName.includes(col)),
    ...columnsWithFullName.filter(col => !priorityColumns.includes(col))
  ];
  
  return sortedColumns;
};

// Funzione per ottenere il colore del ruolo
const getRoleColor = (ruolo: string) => {
  switch (ruolo?.toLowerCase()) {
    case 'politico':
      return 'bg-red-100 text-red-800 border-red-200';
    case 'candidato':
      return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'candidato politico':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'admin':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Funzione per ottenere il colore del genere
const getGenderColor = (genere: string) => {
  switch (genere?.toLowerCase()) {
    case 'uomo':
      return 'bg-cyan-100 text-cyan-800 border-cyan-200';
    case 'donna':
      return 'bg-pink-100 text-pink-800 border-pink-200';
    case 'altro':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

// Funzione per formattare il valore di una colonna
const formatColumnValue = (value: any, columnName: string, user?: User) => {
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

// Funzione per renderizzare il valore con targhette colorate
const renderColumnValue = (value: any, columnName: string, user?: User) => {
  if (columnName === 'ruolo' && value) {
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getRoleColor(value)}`}>
        {value}
      </span>
    );
  }
  
  if (columnName === 'genere' && value) {
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getGenderColor(value)}`}>
        {value}
      </span>
    );
  }
  
  // Gestione speciale per la colonna "Nome Completo" o "name"
  if ((columnName === 'nome_completo' || columnName === 'name') && user) {
    return (
      <Link 
        href={`/menu/profilo/${user.id}?from=utenti`} 
        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
      >
        {user.name} {user.cognome}
      </Link>
    );
  }
  
  return formatColumnValue(value, columnName, user);
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
  const [sortField, setSortField] = useState<keyof User>('nome_completo');
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
         
         // Ricerca speciale per nome completo
         const fullName = `${u.nome || ''} ${u.cognome || ''}`.toLowerCase();
         if (fullName.includes(searchLower)) return true;
         
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
         
         // Gestione speciale per la colonna nome_completo
         if (sortField === 'nome_completo') {
           const fullNameA = `${a.nome || ''} ${a.cognome || ''}`.toLowerCase();
           const fullNameB = `${b.nome || ''} ${b.cognome || ''}`.toLowerCase();
           if (fullNameA < fullNameB) return sortDirection === "asc" ? -1 : 1;
           if (fullNameA > fullNameB) return sortDirection === "asc" ? 1 : -1;
           return 0;
         }
         
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
  const isAdmin = user.role === 'Admin' || (user as any)?.ruolo === 'Admin';
  console.log('🔍 DEBUG GestisciUtenti - Admin check:', { isAdmin, userRole: user.role, userRuolo: (user as any)?.ruolo });
  
  if (!isAdmin) {
    console.log('🔍 DEBUG GestisciUtenti - Redirecting to menu: user is not admin');
    return <Redirect to="/menu" />;
  }
  
     return (
     <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 p-4 select-none">
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

            

                         {/* Sezione utenti in attesa con TABELLA tradizionale */}
             <Card className="bg-white/50 backdrop-blur-sm border-0 shadow-lg mb-8">
               <CardHeader className="pb-4">
                 <CardTitle className="flex items-center text-2xl text-gray-800">
                   <AlertCircle className="h-6 w-6 mr-3 text-yellow-600" />
                   Utenti in Attesa
                 </CardTitle>
                 <CardDescription className="text-gray-600">
                   Visualizza e gestisci gli utenti che attendono l'approvazione
                 </CardDescription>
               </CardHeader>
               <CardContent>
                 {pendingUsers.length > 0 ? (
                   <div className="overflow-x-auto">
                     <Table>
                       <TableHeader>
                         <TableRow>
                           <TableHead className="text-left">Nome Completo</TableHead>
                           <TableHead className="text-left">Email</TableHead>
                           <TableHead className="text-left">Ruolo</TableHead>
                           <TableHead className="text-left">Genere</TableHead>
                           <TableHead className="text-left">Data Creazione</TableHead>
                           <TableHead className="text-center">Azioni</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {pendingUsers.map((pendingUser: any) => (
                           <TableRow key={pendingUser.id} className="hover:bg-gray-50">
                             <TableCell className="max-w-[200px]">
                               <div className="truncate">
                                 <Link 
                                   href={`/menu/profilo/${pendingUser.id}?from=utenti`} 
                                   className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer font-medium"
                                 >
                                   {pendingUser.nome} {pendingUser.cognome}
                                 </Link>
                               </div>
                             </TableCell>
                             <TableCell className="max-w-[200px]">
                               <div className="truncate">{pendingUser.email}</div>
                             </TableCell>
                             <TableCell className="max-w-[150px]">
                               {renderColumnValue(pendingUser.ruolo, 'ruolo', pendingUser)}
                             </TableCell>
                             <TableCell className="max-w-[100px]">
                               {renderColumnValue(pendingUser.genere, 'genere', pendingUser)}
                             </TableCell>
                             <TableCell className="max-w-[150px]">
                               <div className="truncate">
                                 {formatColumnValue(pendingUser.created_at, 'created_at')}
                               </div>
                             </TableCell>
                             <TableCell className="text-center">
                               <div className="flex space-x-2 justify-center">
                                 <Button 
                                   size="sm" 
                                   variant="outline" 
                                   className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200" 
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
                             </TableCell>
                           </TableRow>
                         ))}
                       </TableBody>
                     </Table>
                   </div>
                 ) : (
                   <div className="text-center py-8">
                     <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                     <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun utente in attesa</h3>
                     <p className="text-gray-500">Tutti gli utenti sono stati approvati</p>
                   </div>
                 )}
               </CardContent>
             </Card>

             {/* Sezione utenti attivi con TABELLA tradizionale */}
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
                       placeholder="🔍 Cerca utenti per nome completo, email o ruolo..." 
                       className="pl-10 pr-4 py-2 border-2 border-gray-200 focus:border-blue-500 rounded-lg transition-colors" 
                       value={searchTerm} 
                       onChange={(e) => setSearchTerm(e.target.value)} 
                     />
                  </div>
                  <div className="ml-4 text-sm text-gray-500">
                    {filteredAndSortedUsers.length} utenti trovati
                  </div>
                </div>

                {/* TABELLA tradizionale invece delle card */}
                {paginatedUsers.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {displayColumns.map((column) => (
                            <TableHead 
                              key={column}
                              className="cursor-pointer hover:bg-gray-50"
                              onClick={() => handleSort(column as keyof User)}
                            >
                              <div className="flex items-center space-x-1">
                                                                 <span className="capitalize">
                                   {column === 'nome_completo' ? 'Nome Completo' :
                                    column === 'email' ? 'Email' :
                                    column === 'ruolo' ? 'Ruolo' :
                                    column === 'status' ? 'Status' :
                                    column === 'created_at' ? 'Data Creazione' :
                                    column === 'data_nascita' ? 'Data Nascita' :
                                    column === 'genere' ? 'Genere' :
                                    column === 'cittadinanza' ? 'Cittadinanza' :
                                    column === 'regione' ? 'Regione' :
                                    column === 'provincia' ? 'Provincia' :
                                    column === 'comune' ? 'Comune' :
                                    column === 'paese' ? 'Paese' :
                                    column === 'telefono' ? 'Telefono' :
                                    column === 'professione' ? 'Professione' :
                                    column === 'istruzione' ? 'Istruzione' :
                                    column === 'reddito' ? 'Reddito' :
                                    column === 'partito' ? 'Partito' :
                                    column === 'is_admin' ? 'Admin' :
                                    column === 'is_premium' ? 'Premium' :
                                    column === 'premium' ? 'Premium' :
                                    column === 'avatar_url' ? 'Avatar' :
                                    column === 'bio' ? 'Biografia' :
                                    column === 'social_links' ? 'Social' :
                                    column === 'preferenze_notifiche' ? 'Notifiche' :
                                    column === 'notifiche_preferenze' ? 'Notifiche' :
                                    column === 'paese_candidatura' ? 'Paese Candidatura' :
                                    column === 'regione_candidatura' ? 'Regione Candidatura' :
                                    column === 'provincia_candidatura' ? 'Provincia Candidatura' :
                                    column === 'comune_candidatura' ? 'Comune Candidatura' :
                                    column === 'candidato_attivo' ? 'Candidato Attivo' :
                                    column === 'data_candidatura' ? 'Data Candidatura' :
                                    column === 'status_candidatura' ? 'Status Candidatura' :
                                    column === 'note_candidatura' ? 'Note Candidatura' :
                                    column === 'comune_elezione' ? 'Comune Elezione' :
                                    column === 'grado_elezione' ? 'Grado Elezione' :
                                    column === 'paese_elezione' ? 'Paese Elezione' :
                                    column === 'grado_candidatura' ? 'Grado Candidatura' :
                                    column === 'approved_at' ? 'Data Approvazione' :
                                    column === 'ultimo_accesso' ? 'Ultimo Accesso' :
                                    column === 'data_registrazione' ? 'Data Registrazione' :
                                    column === 'sesso' ? 'Sesso' :
                                    column === 'indirizzo' ? 'Indirizzo' :
                                    column === 'name' ? 'Nome Completo' :
                                    column}
                                </span>
                                {sortField === column && (
                                  <span className="text-blue-600">
                                    {sortDirection === 'asc' ? '↑' : '↓'}
                                  </span>
                                )}
                              </div>
                            </TableHead>
                          ))}
                          <TableHead className="text-center">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.map((u: User) => (
                          <TableRow key={u.id} className="hover:bg-gray-50">
                            {displayColumns.map((column) => (
                              <TableCell key={column} className="max-w-[200px]">
                                <div className="truncate" title={formatColumnValue(u[column], column)}>
                                  {renderColumnValue(u[column], column, u)}
                                </div>
                              </TableCell>
                            ))}
                            <TableCell className="text-center">
                              <div className="flex space-x-2 justify-center">
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => { setSelectedUser(u); setShowEditDialog(true); }}
                                  className="hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 transition-colors"
                                >
                                  <Edit className="h-4 w-4 mr-2" />
                                  Modifica
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => { setSelectedUser(u); setShowEditOpinioniDialog(true); }}
                                  className="hover:bg-green-50 hover:border-green-300 hover:text-green-700 transition-colors"
                                >
                                  📝 Opinioni
                                </Button>
                                <Button 
                                  variant="outline" 
                                  size="sm" 
                                  onClick={() => setUserToDelete(u)}
                                  className="hover:bg-red-50 hover:border-red-300 hover:text-red-700 transition-colors"
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Elimina
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
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
                    <AlertDialogAction onClick={() => userToDelete && deleteMutation.mutate(userToDelete.id)} className="bg-red-500 hover:bg-red-600 text-white" disabled={deleteMutation.isPending}>
                        {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin"/> : "Elimina"}
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        {selectedUser && (
            <>
                <EditUserDialog userUid={selectedUser.id} open={showEditDialog} onOpenChange={setShowEditDialog} onUserUpdated={() => queryClient.invalidateQueries({ queryKey: ['allUsers'] })} />
                <EditOpinioniDialog utenteId={selectedUser.id} open={showEditOpinioniDialog} onOpenChange={setShowEditOpinioniDialog} />
            </>
        )}
      </div>
    </div>
  );
}