import React, { useEffect, useState, useCallback } from "react";
import { Link, Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Search, Trash2, AlertCircle, Edit, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { db, auth } from "@/lib/firebase";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { EditUserDialog } from "@/components/EditUserDialog";
import { ViewUserDialog } from "@/components/ViewUserDialog";
import { EditOpinioniDialog } from "@/components/EditOpinioniDialog";
import { ViewOpinioniDialog } from "@/components/ViewOpinioniDialog";
import { apiRequest } from "@/lib/queryClient";
import { useAuthReady } from "@/hooks/use-auth-ready";
import { useAuth } from "@/hooks/use-auth";

type User = {
  id: string;
  uid: string;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
  status: 'pending' | 'active' | 'rejected';
  [key: string]: any;
};

function GestisciUtenti() {
  const authReady = useAuthReady();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [pendingUsers, setPendingUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showViewOpinioniDialog, setShowViewOpinioniDialog] = useState(false);
  const [showEditOpinioniDialog, setShowEditOpinioniDialog] = useState(false);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    if (!auth.currentUser) {
      console.log("[fetchUsers] Nessun utente, esco");
      return;
    }
    setIsLoadingUsers(true);
    try {
      console.log("[fetchUsers] Chiamo /api/users e /api/pending-users, user:", auth.currentUser);
      const [allUsersResponse, pendingUsersResponse] = await Promise.all([
        fetch("/api/users", { credentials: 'include' }),
        fetch("/api/pending-users", { credentials: 'include' })
      ]);

      const userData = await allUsersResponse.json();
      console.log("[fetchUsers] Risposta /api/users:", userData);
      setUsers(userData.filter((u: User) => u.status === 'active'));
      const pendingData = await pendingUsersResponse.json();
      console.log("[fetchUsers] Risposta /api/pending-users:", pendingData);
      setPendingUsers(pendingData);
    } catch (error) {
      console.error("[fetchUsers] Errore:", error);
      setError("Errore nel caricamento degli utenti");
    } finally {
      setIsLoadingUsers(false);
    }
  }, [auth.currentUser]);

  useEffect(() => {
    if (authReady && user) {
      fetchUsers();
    }
  }, [fetchUsers, authReady, user]);

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  // Show loading while checking authentication
  if (isLoading) {
    return <div className="flex items-center justify-center min-h-screen"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  const handleApproval = async (userId: string, approve: boolean) => {
    setActionInProgress(userId);
    const endpoint = approve ? '/api/approve-user' : '/api/reject-user';
    const actionText = approve ? 'approvato' : 'rifiutato';
    
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `Errore durante l'azione`);
      }

      toast({
        title: `Utente ${actionText}`,
        description: `L'utente è stato ${actionText} con successo.`,
      });
      
      // Ricarica tutti i dati per aggiornare entrambe le liste
      await fetchUsers();

    } catch (error) {
      toast({
        title: 'Errore',
        description: error instanceof Error ? error.message : `Si è verificato un errore`,
        variant: 'destructive',
      });
    } finally {
      setActionInProgress(null);
    }
  };

  // Funzione per eliminare un utente
  const deleteUser = async (userUid: string) => {
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/users/${userUid}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore durante l'eliminazione dell'utente");
      }
      
      // Aggiorna la lista degli utenti rimuovendo l'utente eliminato
      setUsers(prevUsers => prevUsers.filter(u => u.email !== userUid));
      
      toast({
        title: 'Utente eliminato',
        description: 'L\'utente è stato eliminato con successo',
        variant: 'default',
      });
    } catch (error) {
      console.error('Errore durante l\'eliminazione:', error);
      
      toast({
        title: 'Errore',
        description: error instanceof Error ? error.message : 'Si è verificato un errore durante l\'eliminazione dell\'utente',
        variant: 'destructive',
      });
    } finally {
      setIsDeleting(false);
      setShowDeleteDialog(false);
      setUserToDelete(null);
    }
  };
  
  // Apre il dialog di conferma eliminazione
  const openDeleteDialog = (user: User) => {
    setUserToDelete(user);
    setShowDeleteDialog(true);
  };

  // Stato per l'ordinamento
  const [sortField, setSortField] = useState<keyof User | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Funzione per gestire il cambio di ordinamento
  const handleSort = (field: keyof User) => {
    if (sortField === field) {
      // Inverti la direzione se stai già ordinando per questo campo
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Imposta un nuovo campo di ordinamento con direzione ascendente di default
      setSortField(field);
      setSortDirection("asc");
    }
  };

  // Filtra e ordina gli utenti
  const filteredUsers = users
    .filter(user => 
      (user.nome || '').toLowerCase().includes(searchTerm.toLowerCase()) || 
      (user.cognome || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (user.ruolo || '').toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      if (!sortField) return 0;
      
      const valA = a[sortField];
      const valB = b[sortField];
      
      if (valA < valB) return sortDirection === "asc" ? -1 : 1;
      if (valA > valB) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  // Stato per la paginazione
  const [currentPage, setCurrentPage] = useState(1);
  const usersPerPage = 20;
  const totalPages = Math.ceil(filteredUsers.length / usersPerPage);
  const paginatedUsers = filteredUsers.slice((currentPage - 1) * usersPerPage, currentPage * usersPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      {isLoadingUsers ? (
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto max-w-5xl">
          <Button 
            variant="ghost" 
            className="mb-4 flex items-center"
            onClick={() => window.location.href = "/menu"}
          >
            <ArrowLeft className="mr-2 h-4 w-4" /> Torna al Menu
          </Button>
          
          {/* SEZIONE UTENTI IN ATTESA */}
          {pendingUsers.length > 0 && (
            <Card className="mb-8 border-yellow-500">
              <CardHeader>
                <CardTitle className="text-xl font-bold text-yellow-600 flex items-center">
                  <AlertCircle className="mr-2 h-5 w-5" />
                  Utenti in Attesa di Approvazione ({pendingUsers.length})
                </CardTitle>
                <CardDescription>
                  Questi utenti si sono registrati e attendono la tua approvazione per accedere.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Ruolo</TableHead>
                      <TableHead className="text-right">Azioni</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingUsers.map((pendingUser) => (
                      <TableRow key={pendingUser.id}>
                        <TableCell>
                          <Link href={`/profilo/${pendingUser.uid}?from=utenti`} className="cursor-pointer text-blue-600 hover:underline">
                            {pendingUser.nome} {pendingUser.cognome}
                          </Link>
                        </TableCell>
                        <TableCell>{pendingUser.email}</TableCell>
                        <TableCell>{pendingUser.ruolo}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-red-500 hover:text-red-700"
                            onClick={() => handleApproval(pendingUser.id, false)}
                            disabled={actionInProgress === pendingUser.id}
                          >
                            {actionInProgress === pendingUser.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Rifiuta'}
                          </Button>
                          <Button
                            size="sm"
                            className="bg-green-500 hover:bg-green-600"
                            onClick={() => handleApproval(pendingUser.id, true)}
                            disabled={actionInProgress === pendingUser.id}
                          >
                            {actionInProgress === pendingUser.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Approva'}
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Gestione Utenti Attivi
              </CardTitle>
              <CardDescription>
                Visualizza e gestisci gli utenti della piattaforma DEMOS
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {error ? (
                <div className="text-center text-red-500 p-4">
                  {error}
                </div>
              ) : (
                <>
                  <div className="flex items-center mb-4">
                    <div className="relative flex-1">
                      <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        placeholder="Cerca utenti..."
                        className="pl-8"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                    <Button className="ml-2">Aggiungi Utente</Button>
                  </div>
                  
                  <div className="rounded-md border">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead 
                            className="cursor-pointer select-none"
                            onClick={() => handleSort("nome")}
                          >
                            Nome
                            {sortField === "nome" && (
                              <span className="ml-1">
                                {sortDirection === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none"
                            onClick={() => handleSort("cognome")}
                          >
                            Cognome
                            {sortField === "cognome" && (
                              <span className="ml-1">
                                {sortDirection === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none"
                            onClick={() => handleSort("email")}
                          >
                            Email
                            {sortField === "email" && (
                              <span className="ml-1">
                                {sortDirection === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </TableHead>
                          <TableHead 
                            className="cursor-pointer select-none"
                            onClick={() => handleSort("ruolo")}
                          >
                            Ruolo
                            {sortField === "ruolo" && (
                              <span className="ml-1">
                                {sortDirection === "asc" ? "↑" : "↓"}
                              </span>
                            )}
                          </TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedUsers.length > 0 ? (
                          paginatedUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell colSpan={2}>
                                <Link href={`/profilo/${user.uid}?from=utenti`} className="cursor-pointer text-blue-600 hover:underline">
                                  {user.nome} {user.cognome}
                                </Link>
                              </TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>{user.ruolo}</TableCell>
                              <TableCell className="text-right flex flex-wrap justify-end gap-1">
                                <div className="flex space-x-1 items-center justify-end">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUserEmail(user.email);
                                      setSelectedUserId(user.uid);
                                      setShowEditDialog(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => openDeleteDialog(user)}
                                    disabled={isDeleting && userToDelete?.id === user.id}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUserId(user.uid);
                                      setShowEditOpinioniDialog(true);
                                    }}
                                  >
                                    📝 Opinioni
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center">Nessun utente trovato.</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                  {/* Paginazione */}
                  {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-4">
                      <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>&lt;</Button>
                      <span>Pagina {currentPage} di {totalPages}</span>
                      <Button size="sm" variant="outline" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>&gt;</Button>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}
      {/* Dialog di conferma eliminazione */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-500 mr-2" />
              Conferma eliminazione
            </AlertDialogTitle>
            <AlertDialogDescription>
              {userToDelete && (
                <>
                  Sei sicuro di voler eliminare l'utente <strong>{userToDelete.nome} {userToDelete.cognome}</strong> ({userToDelete.email})?
                  <br />
                  <span className="text-red-500 font-medium mt-2 block">
                    Questa operazione non può essere annullata.
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Annulla</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(e) => {
                e.preventDefault();
                if (userToDelete) {
                  deleteUser(userToDelete.email);
                }
              }}
              className="bg-red-500 hover:bg-red-600 text-white"
            >
              {isDeleting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Eliminazione in corso...
                </>
              ) : (
                "Elimina utente"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Dialog di visualizzazione utente */}
      <ViewUserDialog 
        userEmail={selectedUserEmail}
        open={showViewDialog}
        onOpenChange={setShowViewDialog}
      />

      {/* Dialog di modifica utente */}
      <EditUserDialog
        userEmail={selectedUserEmail}
        userUid={selectedUserId}
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onUserUpdated={() => {
          // Aggiorna la lista degli utenti dopo una modifica
          const fetchUsers = async () => {
            try {
              const response = await apiRequest("GET", '/api/users');
              if (response.ok) {
                const data = await response.json();
                setUsers(data as User[]);
              }
            } catch (error) {
              console.error("Errore durante l'aggiornamento della lista utenti:", error);
            }
          };
          fetchUsers();
        }}
      />

      {/* Dialog di visualizzazione opinioni */}
      <ViewOpinioniDialog
        utenteId={selectedUserId}
        open={showViewOpinioniDialog}
        onOpenChange={setShowViewOpinioniDialog}
      />

      {/* Dialog di modifica opinioni */}
      <EditOpinioniDialog
        utenteId={selectedUserId}
        open={showEditOpinioniDialog}
        onOpenChange={setShowEditOpinioniDialog}
        onOpinioniUpdated={() => {
          toast({
            title: "Opinioni aggiornate",
            description: "Le opinioni dell'utente sono state aggiornate con successo",
            variant: "default",
          });
        }}
      />
    </div>
  );
}

export default GestisciUtenti;