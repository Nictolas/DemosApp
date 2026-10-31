import { useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { AmnistiaVotingState, AmnistiaData } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useAmnistiaVoting = (data: AmnistiaData | undefined) => {
  const { toast } = useToast();

  const [votingState, setVotingState] = useState<AmnistiaVotingState>({
    leggeInput: "",
    showSuggestions: false,
    showAllClassifica: false,
    showForm: false
  });

  const updateField = (field: keyof AmnistiaVotingState, value: string | boolean) => {
    setVotingState(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const showSuggestions = () => {
    setVotingState(prev => ({
      ...prev,
      showSuggestions: true
    }));
  };

  const hideSuggestions = () => {
    setTimeout(() => {
      setVotingState(prev => ({
        ...prev,
        showSuggestions: false
      }));
    }, 200);
  };

  const showClassifica = () => {
    setVotingState(prev => ({
      ...prev,
      showAllClassifica: !prev.showAllClassifica
    }));
  };

  const selectSuggestion = (legge: string) => {
    setVotingState(prev => ({
      ...prev,
      leggeInput: legge,
      showSuggestions: false
    }));
  };

  const handleAddVote = (e: React.FormEvent, leggeInput: string, addVoteMutation: any) => {
    e.preventDefault();
    const leggePulita = leggeInput.trim();
    if (!leggePulita) return;
    if (data?.mieiVoti.includes(leggePulita)) {
      toast({ title: "Voto già registrato", description: `Hai già votato per l'amnistia di: ${leggePulita}` });
      return;
    }
    
    // Controlla il limite di voti
    const limit = getVotingLimit('amnistia');
    if (hasReachedVotingLimit('amnistia', data?.mieiVoti.length || 0)) {
      toast({ 
        title: "Limite voti raggiunto", 
        description: `Puoi votare solo ${limit} amnistia. Rimuovi il voto esistente per votarne una diversa.`,
        variant: "destructive"
      });
      return;
    }
    
    addVoteMutation.mutate(leggePulita);
    setVotingState(prev => ({
      ...prev,
      leggeInput: ""
    }));
  };

  const handleRemoveVote = (legge: string, removeVoteMutation: any) => {
    // Rimuovi direttamente senza conferma quando si clicca dalla classifica
    removeVoteMutation.mutate(legge);
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

  const handleCreateAmnistia = async (_data: any) => {
    // La creazione diretta è stata disattivata fino alla disponibilità
    // di una coda di moderazione e dei controlli GDPR necessari.
    toast({
      title: "Proposte temporaneamente sospese",
      description: "La funzione sarà ripristinata dopo l'attivazione dell'approvazione amministrativa.",
      variant: "destructive",
    });
  };

  // Informazioni sui limiti di voto
  const currentVotes = data?.mieiVoti.length || 0;
  const limit = getVotingLimit('amnistia');
  const remainingVotes = getRemainingVotes('amnistia', currentVotes);
  const hasReachedLimit = hasReachedVotingLimit('amnistia', currentVotes);

  return {
    votingState,
    updateField,
    showSuggestions,
    hideSuggestions,
    showClassifica,
    selectSuggestion,
    handleAddVote,
    handleRemoveVote,
    showForm,
    hideForm,
    handleCreateAmnistia,
    // Informazioni sui limiti
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit
  };
};
