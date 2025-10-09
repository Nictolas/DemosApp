import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { GraziaVotingState, GraziaData } from "../types";

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
    if (data?.mieiVoti) {
      setVotingState(prev => ({
        ...prev,
        selectedVoti: data.mieiVoti
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
    setVotingState(prev => ({
      ...prev,
      selectedVoti: prev.selectedVoti.includes(nome) 
        ? prev.selectedVoti.filter(n => n !== nome) 
        : [...prev.selectedVoti, nome]
    }));
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
    handleCreateCarcerato
  };
};
