import React, { useState, useMemo } from "react";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Search, Trash2, AlertCircle, Edit } from "lucide-react";
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
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      <div className="container mx-auto max-w-5xl">
        <Link href="/menu"><Button variant="ghost" className="mb-4 flex items-center"><ArrowLeft className="mr-2 h-4 w-4" />Torna al Menu</Button></Link>
        
        {isLoadingUsers ? (
            <div className="flex items-center justify-center min-h-[80vh]"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : isError ? (
            <div className="text-center text-red-500 p-8">Errore nel caricamento degli utenti.</div>
        ) : (
          <>
            {pendingUsers.length > 0 && (
                <Card className="mb-8 border-yellow-500">
                    <CardHeader>
                        <CardTitle className="text-xl font-bold text-yellow-600 flex items-center"><AlertCircle className="mr-2 h-5 w-5" />Utenti in Attesa ({pendingUsers.length})</CardTitle>
                        <CardDescription>Questi utenti attendono la tua approvazione per accedere.</CardDescription>
                    </CardHeader>
                                         <CardContent>
                         <div className="overflow-x-auto">
                             <Table>
                                 <TableHeader>
                                     <TableRow>
                                         <TableHead>Nome</TableHead>
                                         <TableHead>Email</TableHead>
                                         <TableHead>Ruolo</TableHead>
                                         <TableHead>Status</TableHead>
                                         <TableHead className="text-right">Azioni</TableHead>
                                     </TableRow>
                                 </TableHeader>
                                 <TableBody>
                                     {pendingUsers.map((pendingUser: any) => (
                                         <TableRow key={pendingUser.id}>
                                             <TableCell>
                                                 <Link href={`/menu/profilo/${pendingUser.uid || pendingUser.id}?from=utenti`} className="cursor-pointer text-blue-600 hover:underline">
                                                     {pendingUser.nome} {pendingUser.cognome}
                                                 </Link>
                                             </TableCell>
                                             <TableCell>{pendingUser.email}</TableCell>
                                             <TableCell>{pendingUser.ruolo}</TableCell>
                                             <TableCell>{formatColumnValue(pendingUser.status, 'status')}</TableCell>
                                             <TableCell className="text-right space-x-2">
                                                 <Button size="sm" variant="outline" className="text-red-500 hover:text-red-700" onClick={() => approvalMutation.mutate({ userId: pendingUser.id, approve: false })} disabled={approvalMutation.isPending}>Rifiuta</Button>
                                                 <Button size="sm" className="bg-green-500 hover:bg-green-600" onClick={() => approvalMutation.mutate({ userId: pendingUser.id, approve: true })} disabled={approvalMutation.isPending}>Approva</Button>
                                             </TableCell>
                                         </TableRow>
                                     ))}
                                 </TableBody>
                             </Table>
                         </div>
                     </CardContent>
                </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle className="text-2xl font-bold">Gestione Utenti Attivi</CardTitle>
                <CardDescription>Visualizza e gestisci gli utenti della piattaforma</CardDescription>
              </CardHeader>
              <CardContent>
                  <div className="flex items-center mb-4">
                      <div className="relative flex-1"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" /><Input placeholder="Cerca utenti..." className="pl-8" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} /></div>
                  </div>
                                     <div className="rounded-md border overflow-x-auto">
                     <Table>
                       <TableHeader>
                         <TableRow>
                           {displayColumns.map((col) => (
                             <TableHead 
                               key={col} 
                               onClick={() => handleSort(col as keyof User)} 
                               className="cursor-pointer hover:bg-gray-50"
                             >
                               {col.charAt(0).toUpperCase() + col.slice(1).replace(/_/g, ' ')}
                             </TableHead>
                           ))}
                           <TableHead className="text-right">Azioni</TableHead>
                         </TableRow>
                       </TableHeader>
                       <TableBody>
                         {paginatedUsers.length > 0 ? paginatedUsers.map((u) => (
                           <TableRow key={u.id}>
                             {displayColumns.map((col) => (
                               <TableCell key={col} className="max-w-xs truncate">
                                 {col === 'nome' && u.cognome ? (
                                   <Link href={`/menu/profilo/${u.uid || u.id}?from=utenti`} className="cursor-pointer text-blue-600 hover:underline">
                                     {formatColumnValue(u[col], col)} {formatColumnValue(u.cognome, 'cognome')}
                                   </Link>
                                 ) : (
                                   formatColumnValue(u[col], col)
                                 )}
                               </TableCell>
                             ))}
                             <TableCell className="text-right flex justify-end gap-1">
                               <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(u); setShowEditDialog(true); }}><Edit className="h-4 w-4" /></Button>
                               <Button variant="ghost" size="sm" onClick={() => { setSelectedUser(u); setShowEditOpinioniDialog(true); }}>📝</Button>
                               <Button variant="ghost" size="sm" onClick={() => setUserToDelete(u)}><Trash2 className="h-4 w-4" /></Button>
                             </TableCell>
                           </TableRow>
                         )) : <TableRow><TableCell colSpan={displayColumns.length + 1} className="text-center">Nessun utente trovato.</TableCell></TableRow>}
                       </TableBody>
                     </Table>
                   </div>
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-4">
                      <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Prec.</Button>
                      <span>Pagina {currentPage} di {totalPages}</span>
                      <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Succ.</Button>
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