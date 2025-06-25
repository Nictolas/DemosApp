import React, { useState, useEffect } from "react";
import { UserInfo } from "../pages/Profilo";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { db, auth } from "@/lib/firebase";
import { EditProfileForm } from "./EditProfileForm";

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
      const response = await fetch(`/api/users/${encodeURIComponent(userUid)}`);
      if (!response.ok) {
        throw new Error("Errore nel caricamento dei dati dell'utente");
      }
      const data = await response.json();
      setUserData({ ...data, email: userEmail, uid: userUid });
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Modifica Profilo Utente</DialogTitle>
          <DialogDescription>
            Aggiorna le informazioni del profilo per l'utente {userEmail}
          </DialogDescription>
        </DialogHeader>
        
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
      </DialogContent>
    </Dialog>
  );
}