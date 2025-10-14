import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { IniziativePopolariData } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useIniziativeVoting = (data: IniziativePopolariData | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Effect per aggiornare selectedVoti quando i dati arrivano
  useEffect(() => {
    if (data?.mieiVoti) {
      setSelectedVoti(data.mieiVoti);
    }
  }, [data]);

  // Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: (voti: string[]) => {
      console.log('🔍 DEBUG Frontend - Voti da inviare:', voti);
      console.log('🔍 DEBUG Frontend - Dati iniziative disponibili:', data?.iniziative.map(i => ({ id: i.id, nome: i.nome })));
      return apiRequest("POST", "/api/iniziative-popolari/vota", { voti });
    },
    onSuccess: () => {
      const remainingVotes = getRemainingVotes('iniziative_popolari', selectedVoti.length);
      toast({ 
        title: "Preferenze salvate", 
        description: `Le tue preferenze per le iniziative popolari sono state aggiornate. Voti rimanenti: ${remainingVotes}` 
      });
      queryClient.invalidateQueries({ queryKey: ['iniziativePopolariData'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile salvare le preferenze.", 
        variant: "destructive" 
      });
    },
    onSettled: () => {
      setShowConfirmDialog(false);
    }
  });

  // Logica locale per gestire i voti
  const toggleSelezione = (id: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    
    setSelectedVoti(prev => {
      // Se l'iniziativa è già selezionata, rimuovila
      if (prev.includes(id)) {
        return prev.filter(n => n !== id);
      }
      
      // Se l'utente ha già votato e prova a votare un'altra iniziativa, sostituisci e apri conferma
      const currentVotes = prev.length;
      const limit = getVotingLimit('iniziative_popolari');
      
      if (hasReachedVotingLimit('iniziative_popolari', currentVotes)) {
        // Sostituisci il voto esistente con il nuovo e apri il dialog di conferma
        setShowConfirmDialog(true);
        return [id]; // Sostituisci con il nuovo voto
      }
      
      // Aggiungi il voto
      return [...prev, id];
    });
  };

  const toggleSelezioneClassifica = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    const iniziativa = data?.iniziative.find(i => i.nome === nome);
    if (iniziativa) {
      toggleSelezione(iniziativa.id);
    }
  };

  // Calcola se i voti sono cambiati
  const votiCambiati = JSON.stringify([...selectedVoti].sort()) !== JSON.stringify([...(data?.mieiVoti || [])].sort());

  // Informazioni sui limiti di voto
  const currentVotes = selectedVoti.length;
  const limit = getVotingLimit('iniziative_popolari');
  const remainingVotes = getRemainingVotes('iniziative_popolari', currentVotes);
  const hasReachedLimit = hasReachedVotingLimit('iniziative_popolari', currentVotes);

  return {
    selectedVoti,
    showConfirmDialog,
    setShowConfirmDialog,
    saveVotiMutation,
    toggleSelezione,
    toggleSelezioneClassifica,
    votiCambiati,
    // Informazioni sui limiti
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit
  };
};
