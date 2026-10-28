import React, { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { AvatarEditor } from "@/components/AvatarEditor";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface AvatarConfig {
  skinColor: string;
  hairColor: string;
  hairStyle: string;
  mustacheStyle: string;
  mustacheColor: string;
  beardStyle: string;
  beardColor: string;
  noseStyle: string;
  suitColor: string;
  tieColor: string;
  glassesStyle: string;
  glassesColor: string;
}

interface EditUserAvatarDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  userName: string;
  currentAvatarConfig?: string;
  onAvatarUpdated?: () => void;
}

const defaultAvatarConfig: AvatarConfig = {
  skinColor: "#FDBCB4",
  hairColor: "#8B4513",
  hairStyle: "short",
  mustacheStyle: "none",
  mustacheColor: "#2C1810",
  beardStyle: "none",
  beardColor: "#2C1810",
  noseStyle: "normal",
  suitColor: "#2C3E50",
  tieColor: "#E74C3C",
  glassesStyle: "none",
  glassesColor: "#333333"
};

export function EditUserAvatarDialog({
  open,
  onOpenChange,
  userId,
  userName,
  currentAvatarConfig,
  onAvatarUpdated
}: EditUserAvatarDialogProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [avatarConfig, setAvatarConfig] = useState<AvatarConfig>(defaultAvatarConfig);

  // Parsa la configurazione dell'avatar esistente
  React.useEffect(() => {
    if (currentAvatarConfig) {
      try {
        let config;
        if (typeof currentAvatarConfig === 'string') {
          // Prima prova a fare il parse diretto
          config = JSON.parse(currentAvatarConfig);
          // Se il risultato è ancora una stringa, fai un secondo parse
          if (typeof config === 'string') {
            config = JSON.parse(config);
          }
        } else {
          config = currentAvatarConfig;
        }
        setAvatarConfig({ ...defaultAvatarConfig, ...config });
      } catch (e) {
        console.log(`⚠️ DEBUG EditUserAvatarDialog - Errore parsing avatar per ${userId}:`, e);
        setAvatarConfig(defaultAvatarConfig);
      }
    } else {
      setAvatarConfig(defaultAvatarConfig);
    }
  }, [currentAvatarConfig, userId]);

  // Mutation per salvare l'avatar
  const saveAvatarMutation = useMutation({
    mutationFn: async (config: AvatarConfig) => {
      // apiRequest restituisce direttamente i dati JSON e lancia un'eccezione in caso di errore
      await apiRequest("PUT", `/api/users/${userId}`, {
        avatar_config: JSON.stringify(config)
      });
      
      return config;
    },
    onSuccess: (config) => {
      // Aggiorna immediatamente la cache per un feedback istantaneo
      queryClient.setQueryData(['allUsers'], (oldData: any) => {
        if (!oldData) return oldData;
        
        const avatarConfigString = JSON.stringify(config);
        
        // Funzione helper per aggiungere nome_completo
        const addFullName = (user: any) => ({
          ...user,
          nome_completo: `${user.nome || ''} ${user.cognome || ''}`.trim() || user.name || 'N/A'
        });
        
        // Aggiorna l'utente nella lista degli utenti attivi
        const updatedUtenti = oldData.utenti?.map((user: any) => 
          user.id === userId 
            ? addFullName({ ...user, avatar_config: avatarConfigString })
            : user
        ) || [];
        
        return {
          ...oldData,
          utenti: updatedUtenti
        };
      });
      
      toast({
        title: "Successo",
        description: `Avatar di ${userName} aggiornato con successo!`,
      });
      
      // Invalida anche le query per sincronizzare con il server (in background)
      queryClient.invalidateQueries({ queryKey: ['allUsers'] });
      
      // Chiudi il dialog
      onOpenChange(false);
      
      // Callback opzionale
      onAvatarUpdated?.();
    },
    onError: (error: any) => {
      console.error('Errore nel salvataggio dell\'avatar:', error);
      toast({
        title: "Errore",
        description: error.message || "Errore nel salvataggio dell'avatar",
        variant: "destructive",
      });
    },
  });

  const handleSave = (config: AvatarConfig) => {
    saveAvatarMutation.mutate(config);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-white">
        <DialogHeader>
          <DialogTitle>Modifica Avatar - {userName}</DialogTitle>
          <DialogDescription>
            Personalizza l'avatar per {userName}. Le modifiche verranno salvate immediatamente.
          </DialogDescription>
        </DialogHeader>
        
        <div className="mt-4">
          <AvatarEditor 
            onSave={handleSave}
            initialConfig={avatarConfig}
            isSaving={saveAvatarMutation.isPending}
          />
        </div>
        
        <div className="flex justify-end space-x-2 mt-4">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={saveAvatarMutation.isPending}
          >
            Annulla
          </Button>
          {saveAvatarMutation.isPending && (
            <Button disabled>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvataggio...
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
