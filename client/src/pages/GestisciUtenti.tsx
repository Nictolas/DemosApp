import React, { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft, Search } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { supabase } from "@/lib/supabase";

type User = {
  id: number;
  nome: string;
  cognome: string;
  email: string;
  ruolo: string;
};

export default function GestisciUtenti() {
  const { user, isLoading } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

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
                              <TableCell className="text-right">
                                <Button variant="ghost" size="sm">Visualizza</Button>
                                <Button variant="ghost" size="sm">Modifica</Button>
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
    </div>
  );
}