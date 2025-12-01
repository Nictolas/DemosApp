import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { GraziaVotingState, GraziaData } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useGraziaVoting = (data: GraziaData | undefined) => {
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
      toast({ 
        title: "Limite voti raggiunto", 
        description: `Puoi richiedere grazia per al massimo ${limit} carcerat${limit > 1 ? 'i' : 'o'}. Rimuovi una richiesta esistente per aggiungerne una nuova.`,
        variant: "destructive"
      });
      return;
    }
    
    setVotingState(prev => ({
      ...prev,
      selectedVoti: [...prev.selectedVoti, nomePulito],
      nomeInput: ""
    }));
  };

  const removeLocal = (nome: string) => {
    if (data?.blocco.isBlocked) return;
    setVotingState(prev => ({
      ...prev,
      selectedVoti: prev.selectedVoti.filter(n => n !== nome)
    }));
  };
  
  const toggleSelezioneClassifica = (nome: string) => {
    if (data?.blocco.isBlocked) return;
    setVotingState(prev => {
      // Se il carcerato è già selezionato, rimuovilo
      if (prev.selectedVoti.includes(nome)) {
        return {
          ...prev,
          selectedVoti: prev.selectedVoti.filter(n => n !== nome)
        };
      }
      
      // Se il carcerato non è selezionato, controlla il limite
      const limit = getVotingLimit('grazia');
      if (hasReachedVotingLimit('grazia', prev.selectedVoti.length)) {
        // Sostituisci il voto esistente con il nuovo e apri il dialog di conferma
        return {
          ...prev,
          selectedVoti: [nome], // Sostituisci con il nuovo voto
          showConfirmDialog: true
        };
      }
      
      // Aggiungi il voto
      return {
        ...prev,
        selectedVoti: [...prev.selectedVoti, nome]
      };
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
