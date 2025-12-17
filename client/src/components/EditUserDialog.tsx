import React, { useState, useEffect } from "react";
import { UserInfo } from "@/types/profile";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

import { EditProfileForm } from "./EditProfileForm";
import { apiRequest } from "@/lib/queryClient";

interface EditUserDialogProps {
  userEmail: string;
  userUid: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUserUpdated: () => void;
}

export function EditUserDialog({ userEmail, userUid, open, onOpenChange, onUserUpdated }: EditUserDialogProps) {
  const { toast } = useToast();
  const [userData, setUserData] = useState<(UserInfo & { email: string; uid: string }) | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debug logging per verificare i parametri ricevuti
  console.log('🔍 DEBUG EditUserDialog - Props ricevute:', {
    userEmail,
    userUid,
    open,
    onOpenChange: !!onOpenChange,
    onUserUpdated: !!onUserUpdated
  });

  // Carica i dati dell'utente quando il dialog si apre
  useEffect(() => {
    if (open && userUid) {
      loadUserData();
    }
  }, [open, userUid]);

  const loadUserData = async () => {
    console.log('🔍 DEBUG loadUserData - Inizio caricamento dati per userUid:', userUid);
    setIsLoading(true);
    setError(null);

    try {
      // Carica i dati tramite API usando l'uid
      // apiRequest restituisce un oggetto wrapper con { ok, status, data, json }
      console.log('🔍 DEBUG loadUserData - Chiamando API:', `/api/users/${encodeURIComponent(userUid)}`);
      const response = await apiRequest("GET", `/api/users/${encodeURIComponent(userUid)}`);
      console.log('🔍 DEBUG - Risposta API ricevuta:', response);
      
      // I dati effettivi sono in response.data
      const data = response.data;
      console.log('🔍 DEBUG - Dati utente parsati:', data);
      
      if (data && data.success && data.user) {
        console.log('🔍 DEBUG - Dati utente specifici:', {
          id: data.user.id,
          nome: data.user.nome,
          cognome: data.user.cognome,
          email: data.user.email,
          genere: data.user.genere,
          ruolo: data.user.ruolo,
          data_nascita: data.user.data_nascita,
          cittadinanza: data.user.cittadinanza
        });
        
        // Debug specifico per i dati geografici
        console.log('🔍 DEBUG - Dati geografici ricevuti:', {
          paese_residenza: data.user.paese_residenza,
          regione_residenza: data.user.regione_residenza,
          provincia_residenza: data.user.provincia_residenza,
          comune_residenza: data.user.comune_residenza,
          paese_elezione: data.user.paese_elezione,
          regione_elezione: data.user.regione_elezione,
          provincia_elezione: data.user.provincia_elezione,
          comune_elezione: data.user.comune_elezione,
          paese_candidatura: data.user.paese_candidatura,
          regione_candidatura: data.user.regione_candidatura,
          provincia_candidatura: data.user.provincia_candidatura,
          comune_candidatura: data.user.comune_candidatura
        });
        
        setUserData({ ...data.user, email: userEmail, uid: userUid });
      } else {
        throw new Error(data?.message || data?.error || "Formato dati non valido");
      }
    } catch (err) {
      console.error("Errore:", err);
      setError(err instanceof Error ? err.message : "Errore sconosciuto");
      
      toast({
        title: "Errore",
        description: err instanceof Error ? err.message : "Impossibile caricare i dati dell'utente",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleProfileUpdated = (updatedData: UserInfo) => {
    // Aggiorna i dati locali con i dati restituiti dal server
    setUserData({ ...updatedData, email: userEmail, uid: userUid });
    
    // Notifica il componente padre che i dati sono stati aggiornati
    onUserUpdated();
    
    // Chiudi il dialog
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader className="bg-white">
          <DialogTitle>Modifica Profilo Utente</DialogTitle>
          <DialogDescription>
            Aggiorna le informazioni del profilo per l'utente {userEmail}
          </DialogDescription>
        </DialogHeader>
        
        <div className="bg-white">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500 p-4">
              {error}
              <div className="mt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Chiudi
                </Button>
              </div>
            </div>
          ) : userData ? (
            <EditProfileForm
              userData={userData}
              onProfileUpdated={handleProfileUpdated}
              onCancel={() => onOpenChange(false)}
              isAdmin={true}
            />
          ) : (
            <div className="text-center p-4">
              Nessuna informazione trovata per questo utente.
              <DialogFooter className="mt-4">
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  Chiudi
                </Button>
              </DialogFooter>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
