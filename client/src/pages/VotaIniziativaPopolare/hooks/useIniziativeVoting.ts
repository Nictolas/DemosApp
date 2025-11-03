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
    
    // Usa un callback per accedere allo stato corrente
    setSelectedVoti(prev => {
      // Se l'iniziativa è già selezionata, rimuovila
      if (prev.includes(id)) {
        return prev.filter(n => n !== id);
      }
      
      // Se l'utente ha già votato e prova a votare un'altra iniziativa, mostra alert di conferma
      const currentVotes = prev.length;
      const limit = getVotingLimit('iniziative_popolari');
      
      if (hasReachedVotingLimit('iniziative_popolari', currentVotes)) {
        // Trova il nome dell'iniziativa già votata
        const currentVotedId = prev[0];
        const currentVotedIniziativa = data?.iniziative.find(i => i.id === currentVotedId);
        
        const currentVotedName = currentVotedIniziativa?.nome || 'l\'iniziativa selezionata';
        
        // Mostra alert di conferma sincrono (blocca l'esecuzione finché l'utente non risponde)
        // Salva i valori necessari prima dell'alert
        const newId = id;
        const shouldConfirm = () => {
          const confirmed = window.confirm(
            `Hai votato: ${currentVotedName}.\n\nSicuro di voler cambiare voto?`
          );
          return confirmed;
        };
        
        // Esegui la conferma immediatamente (prima del return)
        // Usiamo una funzione immediatamente invocata per gestire l'alert sincrono
        if (shouldConfirm()) {
          // L'utente ha confermato, sostituisci il voto
          return [newId];
        } else {
          // L'utente ha annullato, mantieni il voto corrente
          return prev;
        }
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
