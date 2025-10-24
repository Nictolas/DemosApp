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

  // Carica i dati dell'utente quando il dialog si apre
  useEffect(() => {
    if (open && userUid) {
      loadUserData();
    }
  }, [open, userUid]);

  const loadUserData = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Carica i dati tramite API usando l'uid
      const response = await apiRequest("GET", `/api/users/${encodeURIComponent(userUid)}`);
      if (!response.ok) {
        throw new Error("Errore nel caricamento dei dati dell'utente");
      }
      const data = await response.json();
      console.log('🔍 DEBUG - Dati utente ricevuti:', data);
      
      if (data.success && data.user) {
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
        setUserData({ ...data.user, email: userEmail, uid: userUid });
      } else {
        throw new Error("Formato dati non valido");
      }
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

  const handleProfileUpdated = (updatedData: UserInfo) => {
    toast({
      title: "Profilo aggiornato",
      description: "Il profilo è stato aggiornato con successo",
      variant: "default",
    });
    
    onOpenChange(false);
    onUserUpdated();
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
