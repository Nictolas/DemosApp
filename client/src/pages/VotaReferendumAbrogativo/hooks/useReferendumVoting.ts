import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { ReferendumAbrogativiData } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useReferendumVoting = (data: ReferendumAbrogativiData | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);

  // Effect per aggiornare selectedVoti quando i dati arrivano
  useEffect(() => {
    if (data?.mieiVoti) {
      setSelectedVoti(data.mieiVoti);
    }
  }, [data]);

  // Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: (voti: string[]) => apiRequest("POST", "/api/referendum-abrogativi/vota", { voti }),
    onSuccess: () => {
      const remainingVotes = getRemainingVotes('referendum_abrogativi', selectedVoti.length);
      toast({ 
        title: "Preferenze salvate", 
        description: `Le tue preferenze per i referendum abrogativi sono state aggiornate. Voti rimanenti: ${remainingVotes}` 
      });
      queryClient.invalidateQueries({ queryKey: ['referendumAbrogativiData'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile salvare le preferenze.", 
        variant: "destructive" 
      });
    }
  });

  // Logica locale per gestire i voti
  const toggleSelezione = (referendumId: string) => {
    if (saveVotiMutation.isPending || data?.blocco?.isBlocked) return;
    
    setSelectedVoti(prev => {
      // Se il referendum è già selezionato, rimuovilo
      if (prev.includes(referendumId)) {
        return prev.filter(id => id !== referendumId);
      }
      
      // Se il referendum non è selezionato, controlla il limite
      const currentVotes = prev.length;
      const limit = getVotingLimit('referendum_abrogativi');
      
      if (hasReachedVotingLimit('referendum_abrogativi', currentVotes)) {
        // Sostituisci il voto esistente con il nuovo e apri il dialog di conferma
        setShowConfirmDialog(true);
        return [referendumId]; // Sostituisci con il nuovo voto
      }
      
      // Aggiungi il voto
      return [...prev, referendumId];
    });
  };

  const toggleSelezioneClassifica = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco?.isBlocked) return;
    const referendum = data?.referendum.find(r => r.nome === nome);
    if (referendum) {
      toggleSelezione(referendum.id);
    }
  };

  // Calcola se i voti sono cambiati
  const votiCambiati = JSON.stringify([...selectedVoti].sort()) !== JSON.stringify([...(data?.mieiVoti || [])].sort());

  // Informazioni sui limiti di voto
  const currentVotes = selectedVoti.length;
  const limit = getVotingLimit('referendum_abrogativi');
  const remainingVotes = getRemainingVotes('referendum_abrogativi', currentVotes);
  const hasReachedLimit = hasReachedVotingLimit('referendum_abrogativi', currentVotes);

  return {
    selectedVoti,
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
