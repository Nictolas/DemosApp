import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CapoStatoData } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useCapoStatoVoting = (data: CapoStatoData | undefined) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedVoti, setSelectedVoti] = useState<string[]>([]);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Effect per aggiornare selectedVoti quando i dati arrivano
  useEffect(() => {
    if (data?.mieiVoti !== undefined) {
      // Aggiorna sempre selectedVoti quando mieiVoti è disponibile (anche se vuoto)
      setSelectedVoti(data.mieiVoti);
    }
  }, [data?.mieiVoti]);

  // Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: (voti: string[]) => {
      console.log('🔍 DEBUG - Tentativo di salvataggio voti:', voti);
      // Usa l'endpoint originale ma con logging
      return apiRequest("POST", "/api/capo-stato/vota", { voti });
    },
    onSuccess: () => {
      const remainingVotes = getRemainingVotes('capo_stato', selectedVoti.length);
      toast({ 
        title: "Preferenze salvate", 
        description: `I tuoi voti sono stati aggiornati. Voti rimanenti: ${remainingVotes}` 
      });
      queryClient.invalidateQueries({ queryKey: ['capoStatoData'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare i voti.", variant: "destructive" });
    },
    onSettled: () => {
      setShowConfirmDialog(false);
    }
  });

  // Logica locale per aggiungere/rimuovere voti dalla selezione temporanea
  const handleAddNomeLocal = (nome: string) => {
    if (selectedVoti.includes(nome)) {
      toast({ title: "Voto già selezionato", description: `Hai già selezionato ${nome}` });
      return;
    }
    
    // Controlla il limite di voti massimi
    const limit = getVotingLimit('capo_stato');
    if (hasReachedVotingLimit('capo_stato', selectedVoti.length)) {
      toast({ 
        title: "Limite voti raggiunto", 
        description: `Puoi selezionare al massimo ${limit} candidato${limit > 1 ? 'i' : ''}` 
      });
      return;
    }
    
    setSelectedVoti(prev => [...prev, nome]);
  };

  const handleRemoveLocal = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    setSelectedVoti(prev => prev.filter(n => n !== nome));
  };
  
  const toggleSelezione = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    
    setSelectedVoti(prev => {
      if (prev.includes(nome)) {
        // Rimuovi il voto
        return prev.filter(n => n !== nome);
      } else {
        // Se l'utente ha già votato e prova a votare qualcun altro, sostituisci e apri conferma
        const limit = getVotingLimit('capo_stato');
        if (hasReachedVotingLimit('capo_stato', prev.length)) {
          // Sostituisci il voto esistente con il nuovo e apri il dialog di conferma
          setShowConfirmDialog(true);
          return [nome]; // Sostituisci con il nuovo voto
        }
        return [...prev, nome];
      }
    });
  };

  // Calcola se i voti sono cambiati
  const votiCambiati = JSON.stringify([...selectedVoti].sort()) !== JSON.stringify([...(data?.mieiVoti || [])].sort());

  // Informazioni sui limiti di voto
  const currentVotes = selectedVoti.length;
  const limit = getVotingLimit('capo_stato');
  const remainingVotes = getRemainingVotes('capo_stato', currentVotes);
  const hasReachedLimit = hasReachedVotingLimit('capo_stato', currentVotes);

  return {
    selectedVoti,
    showConfirmDialog,
    setShowConfirmDialog,
    saveVotiMutation,
    handleAddNomeLocal,
    handleRemoveLocal,
    toggleSelezione,
    votiCambiati,
    // Informazioni sui limiti
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit
  };
};
