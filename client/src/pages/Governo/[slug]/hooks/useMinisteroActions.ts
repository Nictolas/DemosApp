import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { MinisteroVotingState, MinisteroData } from "../types";
import { UseMutationResult } from "@tanstack/react-query";

interface UseMinisteroActionsProps {
  data: MinisteroData | undefined;
  saveVotiMutation: UseMutationResult<any, any, string[], unknown>;
}

export const useMinisteroActions = ({ data, saveVotiMutation }: UseMinisteroActionsProps) => {
  const { toast } = useToast();
  
  const [votingState, setVotingState] = useState<MinisteroVotingState>({
    nomeInput: "",
    selectedVoti: [],
    showConfirmDialog: false,
    showAllClassifica: false,
    showSuggestions: false
  });

  // Effect per aggiornare selectedVoti quando i dati arrivano
  useEffect(() => {
    if (data?.mieiVoti) {
      setVotingState(prev => ({
        ...prev,
        selectedVoti: data.mieiVoti
      }));
    }
  }, [data]);

  const updateField = (field: keyof MinisteroVotingState, value: string | string[] | boolean) => {
    setVotingState(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const showClassifica = () => {
    setVotingState(prev => ({
      ...prev,
      showConfirmDialog: true
    }));
  };

  const hideForm = () => {
    setVotingState(prev => ({
      ...prev,
      showConfirmDialog: false
    }));
  };

  const addNomeLocal = (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = votingState.nomeInput.trim();
    if (!nomePulito) return;
    
    if (votingState.selectedVoti.includes(nomePulito)) {
      toast({ title: "Candidato già selezionato" });
      return;
    }
    
    // Se l'utente è bloccato, non permettere modifiche
    if (data?.blocco.isBlocked) {
      toast({ title: "Voti bloccati", description: "Non puoi modificare i voti più di una volta a settimana.", variant: "destructive" });
      return;
    }
    
    // Permetti solo un voto per utente - sostituisci sempre con il nuovo candidato
    const nuoviVoti = [nomePulito];
    setVotingState(prev => ({
      ...prev,
      selectedVoti: nuoviVoti,
      nomeInput: ""
    }));
    
    // Salva automaticamente dopo aver aggiornato lo stato
    setTimeout(() => {
      saveVotiMutation.mutate(nuoviVoti);
    }, 0);
  };

  const removeLocal = (nome: string) => {
    if (data?.blocco.isBlocked) {
      toast({ title: "Voti bloccati", description: "Non puoi modificare i voti più di una volta a settimana.", variant: "destructive" });
      return;
    }
    
    if (saveVotiMutation.isPending) {
      return;
    }
    
    const nuoviVoti = votingState.selectedVoti.filter(n => n !== nome);
    setVotingState(prev => ({
      ...prev,
      selectedVoti: nuoviVoti
    }));
    
    // Salva automaticamente dopo aver rimosso il voto
    setTimeout(() => {
      saveVotiMutation.mutate(nuoviVoti);
    }, 0);
  };
  
  const toggleSelezioneClassifica = (nome: string) => {
    if (data?.blocco.isBlocked) {
      toast({ title: "Voti bloccati", description: "Non puoi modificare i voti più di una volta a settimana.", variant: "destructive" });
      return;
    }
    
    if (saveVotiMutation.isPending) {
      return;
    }
    
    setVotingState(prev => {
      if (prev.selectedVoti.includes(nome)) {
        // Rimuovi il voto e salva automaticamente
        const nuoviVoti: string[] = [];
        setTimeout(() => {
          saveVotiMutation.mutate(nuoviVoti);
        }, 0);
        return {
          ...prev,
          selectedVoti: nuoviVoti
        };
      } else {
        // Sostituisci con il nuovo candidato (un solo voto) e salva automaticamente
        const nuoviVoti = [nome];
        setTimeout(() => {
          saveVotiMutation.mutate(nuoviVoti);
        }, 0);
        return {
          ...prev,
          selectedVoti: nuoviVoti
        };
      }
    });
  };

  const saveVoti = () => {
    // Questa funzione non è più necessaria, ma la manteniamo per compatibilità
    setVotingState(prev => ({
      ...prev,
      showConfirmDialog: false
    }));
  };

  return {
    votingState,
    setVotingState,
    updateField,
    addNomeLocal,
    removeLocal,
    toggleSelezioneClassifica,
    showClassifica,
    saveVoti
  };
};
