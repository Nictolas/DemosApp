import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { MinisteroVotingState, MinisteroData } from "../types";

export const useMinisteroActions = (data: MinisteroData | undefined) => {
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
    // Permetti solo un voto per utente
    setVotingState(prev => ({
      ...prev,
      selectedVoti: [nomePulito], // Sostituisce sempre con il nuovo candidato
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
        ? [] // Rimuovi se già selezionato
        : [nome] // Sostituisci con il nuovo candidato (un solo voto)
    }));
  };

  const saveVoti = () => {
    // Questa funzione sarà chiamata dal componente padre con la mutazione
    setVotingState(prev => ({
      ...prev,
      showConfirmDialog: false
    }));
  };

  return {
    votingState,
    updateField,
    addNomeLocal,
    removeLocal,
    toggleSelezioneClassifica,
    showClassifica,
    saveVoti
  };
};
