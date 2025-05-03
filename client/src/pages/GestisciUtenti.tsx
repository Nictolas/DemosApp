import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Search, Trash2, AlertCircle, Edit, Eye } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";
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

type User = {
  id: number;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
};

export default function GestisciUtenti() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
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

  useEffect(() => {
    const fetchUsers = async () => {
      if (!user) return;
      
      try {
        // Carica i dati da Supabase
        const { data: supabaseUsers, error: supabaseError } = await supabase
          .from('utenti')
          .select('*');
        
        if (supabaseUsers && supabaseUsers.length > 0) {
          console.log("Utenti caricati da Supabase:", supabaseUsers);
          setUsers(supabaseUsers as User[]);
        } else {
          console.log("Dati non trovati in Supabase, caricamento dal database locale:", supabaseError);
          
          // Fallback: carica i dati dal database locale
          const response = await fetch("/api/users");
          if (!response.ok) {
            throw new Error("Errore nel caricamento degli utenti");
          }
          
          const data = await response.json();
          setUsers(data);
        }
      } catch (error) {
        console.error("Errore:", error);
        setError("Errore nel caricamento degli utenti");
      } finally {
        setIsLoadingUsers(false);
      }
    };

    if (user) {
      fetchUsers();
    }
  }, [user]);

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  // Funzione per eliminare un utente
  const deleteUser = async (userEmail: string) => {
    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/users/${userEmail}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Errore durante l'eliminazione dell'utente");
      }
      
      // Aggiorna la lista degli utenti rimuovendo l'utente eliminato
      setUsers(prevUsers => prevUsers.filter(u => u.email !== userEmail));
      
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

  // Filter users based on search term
  const filteredUsers = users.filter(user => 
    user.nome.toLowerCase().includes(searchTerm.toLowerCase()) || 
    user.cognome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.ruolo.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      {isLoading || isLoadingUsers ? (
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
          
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-blue-600 bg-clip-text text-transparent">
                Gestione Utenti
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
                          <TableHead>ID</TableHead>
                          <TableHead>Nome</TableHead>
                          <TableHead>Cognome</TableHead>
                          <TableHead>Email</TableHead>
                          <TableHead>Ruolo</TableHead>
                          <TableHead className="text-right">Azioni</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredUsers.length > 0 ? (
                          filteredUsers.map((user) => (
                            <TableRow key={user.id}>
                              <TableCell>{user.id}</TableCell>
                              <TableCell>{user.nome}</TableCell>
                              <TableCell>{user.cognome}</TableCell>
                              <TableCell>{user.email}</TableCell>
                              <TableCell>{user.ruolo}</TableCell>
                              <TableCell className="text-right flex flex-wrap justify-end gap-1">
                                <div className="flex space-x-1 items-center justify-end">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUserEmail(user.email);
                                      setShowViewDialog(true);
                                    }}
                                  >
                                    <Eye className="h-4 w-4 mr-1" />
                                    Visualizza
                                  </Button>
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    onClick={() => {
                                      setSelectedUserEmail(user.email);
                                      setShowEditDialog(true);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-1" />
                                    Modifica
                                  </Button>
                                </div>
                                <div className="flex space-x-1 mt-1 items-center justify-end">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-blue-500"
                                    onClick={() => {
                                      setSelectedUserId(user.id.toString());
                                      setShowViewOpinioniDialog(true);
                                    }}
                                  >
                                    Visualizza Opinioni
                                  </Button>
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="text-green-600"
                                    onClick={() => {
                                      setSelectedUserId(user.id.toString());
                                      setShowEditOpinioniDialog(true);
                                    }}
                                  >
                                    Modifica Opinioni
                                  </Button>
                                </div>
                                <div className="flex justify-end mt-1">
                                  <Button 
                                    variant="ghost" 
                                    size="sm"
                                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                                    onClick={() => openDeleteDialog(user)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-1" />
                                    Elimina
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))
                        ) : (
                          <TableRow>
                            <TableCell colSpan={6} className="text-center">
                              Nessun utente trovato
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
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
        open={showEditDialog}
        onOpenChange={setShowEditDialog}
        onUserUpdated={() => {
          // Aggiorna la lista degli utenti dopo una modifica
          const fetchUsers = async () => {
            try {
              const { data, error } = await supabase
                .from('utenti')
                .select('*');
              
              if (data) {
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