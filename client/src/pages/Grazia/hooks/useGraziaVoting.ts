import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { GraziaVotingState, GraziaData } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";
import { UseMutationResult } from "@tanstack/react-query";

export const useGraziaVoting = (
  data: GraziaData | undefined,
  saveVotiMutation: UseMutationResult<any, any, string[], any>
) => {
  const { toast } = useToast();
  
  const [votingState, setVotingState] = useState<GraziaVotingState>({
    nomeInput: "",
    selectedVoti: [],
    showConfirmDialog: false,
    showAllClassifica: false,
    showForm: false
  });

  // Effect per aggiornare selectedVoti quando i dati arrivano
  useEffect(() => {
    if (data && Array.isArray(data.mieiVoti)) {
      setVotingState(prev => ({
        ...prev,
        selectedVoti: data.mieiVoti
      }));
    } else if (!data) {
      // Se data non è ancora caricato, resetta selectedVoti
      setVotingState(prev => ({
        ...prev,
        selectedVoti: []
      }));
    }
  }, [data]);

  const updateField = (field: keyof GraziaVotingState, value: string | string[] | boolean) => {
    setVotingState(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const showForm = () => {
    setVotingState(prev => ({
      ...prev,
      showForm: true
    }));
  };

  const hideForm = () => {
    setVotingState(prev => ({
      ...prev,
      showForm: false
    }));
  };

  const addNomeLocal = (e: React.FormEvent) => {
    e.preventDefault();
    const nomePulito = votingState.nomeInput.trim();
    if (!nomePulito) return;
    if (votingState.selectedVoti.includes(nomePulito)) {
      toast({ title: "Richiesta già selezionata" });
      return;
    }
    
    // Controlla il limite di voti
    const limit = getVotingLimit('grazia');
    if (hasReachedVotingLimit('grazia', votingState.selectedVoti.length)) {
      // Se ha già raggiunto il limite, sostituisci il voto e salva automaticamente
      const nuoviVoti = [nomePulito];
      setVotingState(prev => ({
        ...prev,
        selectedVoti: nuoviVoti,
        nomeInput: "",
        showConfirmDialog: true
      }));
      // Salva automaticamente dopo aver aggiornato lo stato
      setTimeout(() => {
        saveVotiMutation.mutate(nuoviVoti);
      }, 0);
      return;
    }
    
    // Se non ha raggiunto il limite, aggiungi il voto e salva automaticamente
    const nuoviVoti = [...votingState.selectedVoti, nomePulito];
    setVotingState(prev => ({
      ...prev,
      selectedVoti: nuoviVoti,
      nomeInput: "",
      showConfirmDialog: true
    }));
    // Salva automaticamente dopo aver aggiornato lo stato
    setTimeout(() => {
      saveVotiMutation.mutate(nuoviVoti);
    }, 0);
  };

  const removeLocal = (nome: string) => {
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
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
    if (saveVotiMutation.isPending || data?.blocco.isBlocked) return;
    
    setVotingState(prev => {
      if (prev.selectedVoti.includes(nome)) {
        // Rimuovi il voto e salva automaticamente
        const nuoviVoti = prev.selectedVoti.filter(n => n !== nome);
        setTimeout(() => {
          saveVotiMutation.mutate(nuoviVoti);
        }, 0);
        return {
          ...prev,
          selectedVoti: nuoviVoti
        };
      } else {
        // Se l'utente ha già votato e prova a votare qualcun altro, sostituisci e salva
        const limit = getVotingLimit('grazia');
        
        if (hasReachedVotingLimit('grazia', prev.selectedVoti.length)) {
          // Sostituisci il voto esistente con il nuovo e salva automaticamente
          const nuoviVoti = [nome];
          setTimeout(() => {
            saveVotiMutation.mutate(nuoviVoti);
          }, 0);
          return {
            ...prev,
            selectedVoti: nuoviVoti,
            showConfirmDialog: true
          };
        } else {
          // Primo voto o aggiunta normale, salva automaticamente
          const nuoviVoti = [...prev.selectedVoti, nome];
          setTimeout(() => {
            saveVotiMutation.mutate(nuoviVoti);
          }, 0);
          return {
            ...prev,
            selectedVoti: nuoviVoti,
            showConfirmDialog: true
          };
        }
      }
    });
  };

  const showClassifica = () => {
    setVotingState(prev => ({
      ...prev,
      showAllClassifica: !prev.showAllClassifica
    }));
  };

  const saveVoti = () => {
    setVotingState(prev => ({
      ...prev,
      showConfirmDialog: false
    }));
  };

  const handleCreateCarcerato = (data: any) => {
    // Qui implementerai la logica per creare un nuovo carcerato
    console.log('Nuovo carcerato:', data);
    toast({
      title: "Carcerato proposto",
      description: "La proposta è stata inviata per la revisione."
    });
    hideForm();
  };

  // Informazioni sui limiti di voto
  const currentVotes = votingState.selectedVoti.length;
  const limit = getVotingLimit('grazia');
  const remainingVotes = getRemainingVotes('grazia', currentVotes);
  const hasReachedLimit = hasReachedVotingLimit('grazia', currentVotes);

  return {
    votingState,
    updateField,
    showForm,
    hideForm,
    addNomeLocal,
    removeLocal,
    toggleSelezioneClassifica,
    showClassifica,
    saveVoti,
    handleCreateCarcerato,
    // Informazioni sui limiti
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit
  };
};
