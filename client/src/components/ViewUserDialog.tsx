import React, { useState, useEffect } from "react";
import { UserInfo } from "@/types/user";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { apiRequest } from "@/lib/queryClient";

interface ViewUserDialogProps {
  userEmail: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ViewUserDialog({ userEmail, open, onOpenChange }: ViewUserDialogProps) {
  const { toast } = useToast();
  const [userData, setUserData] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Carica i dati dell'utente quando il dialog si apre
  useEffect(() => {
    if (open && userEmail) {
      loadUserData();
    }
  }, [open, userEmail]);

  const loadUserData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Carica i dati tramite API
      const response = await apiRequest("GET", `/api/users/${encodeURIComponent(userEmail)}`);
      
      if (!response.ok) {
        throw new Error("Errore nel caricamento dei dati dell'utente");
      }
      
      const data = await response.json();
      console.log("Dati utente caricati per visualizzazione:", data);
      setUserData(data);
    } catch (err) {
      console.error("Errore:", err);
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
      
      toast({
        title: "Errore",
        description: "Impossibile caricare i dati dell'utente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Dettagli Utente</DialogTitle>
          <DialogDescription>
            Visualizza le informazioni complete dell'utente {userEmail}
          </DialogDescription>
        </DialogHeader>
        
        {isLoading ? (
          <div className="flex justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center text-red-500 p-4">
            {error}
          </div>
        ) : userData ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-2">
            <div>
              <h3 className="text-lg font-medium mb-2">Informazioni personali</h3>
              <div className="space-y-2 bg-gray-50 p-4 rounded-md">
                <p><strong>Nome:</strong> {userData.nome}</p>
                <p><strong>Cognome:</strong> {userData.cognome}</p>
                <p><strong>Data di nascita:</strong> {userData.data_nascita}</p>
                <p><strong>Genere:</strong> {userData.genere}</p>
                <p><strong>Cittadinanza:</strong> {userData.cittadinanza}</p>
                <p><strong>Email:</strong> {userEmail}</p>
                <p><strong>Ruolo:</strong> {userData.ruolo}</p>
              </div>
            </div>
            
            <div>
              <h3 className="text-lg font-medium mb-2">Residenza</h3>
              <div className="space-y-2 bg-gray-50 p-4 rounded-md">
                <p><strong>Paese:</strong> {userData.paese_residenza}</p>
                <p><strong>Regione:</strong> {userData.regione_residenza}</p>
                <p><strong>Provincia:</strong> {userData.provincia_residenza}</p>
                <p><strong>Comune:</strong> {userData.comune_residenza}</p>
              </div>
              
              {userData.paese_elezione && (
                <>
                  <h3 className="text-lg font-medium mt-4 mb-2">Elezione</h3>
                  <div className="space-y-2 bg-gray-50 p-4 rounded-md">
                    <p><strong>Paese:</strong> {userData.paese_elezione}</p>
                    <p><strong>Regione:</strong> {userData.regione_elezione}</p>
                    <p><strong>Provincia:</strong> {userData.provincia_elezione}</p>
                    <p><strong>Comune:</strong> {userData.comune_elezione}</p>
                    <p><strong>Grado:</strong> {userData.grado_elezione}</p>
                  </div>
                </>
              )}
              
              {userData.paese_candidatura && (
                <>
                  <h3 className="text-lg font-medium mt-4 mb-2">Candidatura</h3>
                  <div className="space-y-2 bg-gray-50 p-4 rounded-md">
                    <p><strong>Paese:</strong> {userData.paese_candidatura}</p>
                    <p><strong>Regione:</strong> {userData.regione_candidatura}</p>
                    <p><strong>Provincia:</strong> {userData.provincia_candidatura}</p>
                    <p><strong>Comune:</strong> {userData.comune_candidatura}</p>
                    <p><strong>Grado:</strong> {userData.grado_candidatura}</p>
                  </div>
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center p-4">
            Nessuna informazione trovata per questo utente.
          </div>
        )}
        
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>
            Chiudi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
