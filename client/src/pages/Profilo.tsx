import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Redirect } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, ArrowLeft, Edit, User } from "lucide-react";
import { UserInfo } from "@/types";
import { supabase } from "@/lib/supabase";
import { EditProfileForm } from "@/components/EditProfileForm";
import { useToast } from "@/hooks/use-toast";

export default function Profilo() {
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [isLoadingInfo, setIsLoadingInfo] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user) return;
      
      try {
        // Primo tentativo: carica i dati da Supabase
        const { data: supabaseData, error: supabaseError } = await supabase
          .from('utenti')
          .select('*')
          .eq('email', user.email)
          .single();
        
        if (supabaseData) {
          console.log("Dati utente caricati da Supabase:", supabaseData);
          setUserInfo(supabaseData as UserInfo);
        } else {
          console.log("Dati non trovati in Supabase, caricamento dal database locale:", supabaseError);
          
          // Fallback: carica i dati dal database locale
          const response = await fetch(`/api/users/${user.id}/profile`);
          if (!response.ok) {
            throw new Error("Errore nel caricamento dei dati del profilo");
          }
          
          const data = await response.json();
          setUserInfo(data);
        }
      } catch (error) {
        console.error("Errore:", error);
        setError("Errore nel caricamento dei dati del profilo");
      } finally {
        setIsLoadingInfo(false);
      }
    };

    if (user) {
      fetchUserInfo();
    }
  }, [user]);

  // Redirect to auth page if not logged in
  if (!user && !isLoading) {
    return <Redirect to="/auth" />;
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20 p-4">
      {isLoading || isLoadingInfo ? (
        <div className="flex items-center justify-center min-h-[80vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="container mx-auto max-w-4xl">
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
                Il tuo Profilo
              </CardTitle>
              <CardDescription>
                Visualizza e gestisci le tue informazioni personali
              </CardDescription>
            </CardHeader>
            
            <CardContent>
              {error ? (
                <div className="text-center text-red-500 p-4">
                  {error}
                </div>
              ) : userInfo && user ? (
                isEditing ? (
                  <EditProfileForm 
                    userData={{...userInfo, email: user.email}} 
                    onProfileUpdated={(updatedData) => {
                      // Mostra un toast di conferma
                      toast({
                        title: "Profilo aggiornato",
                        description: "Il profilo è stato aggiornato con successo",
                        variant: "default",
                      });
                      
                      // Reindirizza al menu invece di aggiornare lo stato locale
                      window.location.href = "/menu";
                    }}
                    onCancel={() => setIsEditing(false)}
                  />
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="text-lg font-medium mb-2">Informazioni personali</h3>
                      <div className="space-y-2">
                        <p><strong>Nome:</strong> {userInfo.nome}</p>
                        <p><strong>Cognome:</strong> {userInfo.cognome}</p>
                        <p><strong>Data di nascita:</strong> {userInfo.data_nascita}</p>
                        <p><strong>Genere:</strong> {userInfo.genere}</p>
                        <p><strong>Cittadinanza:</strong> {userInfo.cittadinanza}</p>
                        <p><strong>Ruolo:</strong> {userInfo.ruolo}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="text-lg font-medium mb-2">Residenza</h3>
                      <div className="space-y-2">
                        <p><strong>Paese:</strong> {userInfo.paese_residenza}</p>
                        <p><strong>Regione:</strong> {userInfo.regione_residenza}</p>
                        <p><strong>Provincia:</strong> {userInfo.provincia_residenza}</p>
                        <p><strong>Comune:</strong> {userInfo.comune_residenza}</p>
                      </div>
                      
                      {userInfo.paese_elezione && (
                        <>
                          <h3 className="text-lg font-medium mt-4 mb-2">Elezione</h3>
                          <div className="space-y-2">
                            <p><strong>Paese:</strong> {userInfo.paese_elezione}</p>
                            <p><strong>Regione:</strong> {userInfo.regione_elezione}</p>
                            <p><strong>Provincia:</strong> {userInfo.provincia_elezione}</p>
                            <p><strong>Comune:</strong> {userInfo.comune_elezione}</p>
                            <p><strong>Grado:</strong> {userInfo.grado_elezione}</p>
                          </div>
                        </>
                      )}
                      
                      {userInfo.paese_candidatura && (
                        <>
                          <h3 className="text-lg font-medium mt-4 mb-2">Candidatura</h3>
                          <div className="space-y-2">
                            <p><strong>Paese:</strong> {userInfo.paese_candidatura}</p>
                            <p><strong>Regione:</strong> {userInfo.regione_candidatura}</p>
                            <p><strong>Provincia:</strong> {userInfo.provincia_candidatura}</p>
                            <p><strong>Comune:</strong> {userInfo.comune_candidatura}</p>
                            <p><strong>Grado:</strong> {userInfo.grado_candidatura}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                )
              ) : (
                <div className="text-center p-4">
                  Nessuna informazione trovata per questo utente.
                </div>
              )}
            </CardContent>
            
            <CardFooter className="flex justify-end">
              {userInfo && user && !isEditing && (
                <Button onClick={() => setIsEditing(true)}>
                  <Edit className="mr-2 h-4 w-4" />
                  Modifica Profilo
                </Button>
              )}
            </CardFooter>
          </Card>
        </div>
      )}
    </div>
  );
}