import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { GraziaVotingState, GraziaData } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";
import { UseMutationResult } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CarceratoFormData } from "../constants/schema";

export const useGraziaVoting = (
  data: GraziaData | undefined,
  saveVotiMutation: UseMutationResult<any, any, string[], any>
) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [votingState, setVotingState] = useState<GraziaVotingState>({
    nomeInput: "",
    selectedVoti: [],
    showConfirmDialog: false,
    showForm: false
  });
  const [isSubmittingProposal, setIsSubmittingProposal] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState(false);
  const [votoToRemove, setVotoToRemove] = useState<string | null>(null);

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
    const input = votingState.nomeInput.trim();
    if (!input) return;
    const approved = data?.classifica?.find(item => item.nome.toLocaleLowerCase('it') === input.toLocaleLowerCase('it'));
    if (!approved) {
      toast({
        title: "Nome non presente nella classifica",
        description: "Puoi votare solo persone già approvate. Usa Proponi per chiedere una nuova valutazione.",
        variant: "destructive",
      });
      return;
    }
    const nomePulito = approved.nome;
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
        nomeInput: ""
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
      nomeInput: ""
    }));
    // Salva automaticamente dopo aver aggiornato lo stato
    setTimeout(() => {
      saveVotiMutation.mutate(nuoviVoti);
    }, 0);
  };

  const removeLocal = (nome: string) => {
    console.log('🔍 DEBUG CLIENT - removeLocal chiamato con nome:', nome);
    console.log('🔍 DEBUG CLIENT - isPending:', saveVotiMutation.isPending);
    console.log('🔍 DEBUG CLIENT - isBlocked:', data?.blocco.isBlocked);
    
    // La rimozione è sempre permessa, anche se l'utente è bloccato
    // Solo controlliamo se c'è una mutation in corso
    if (saveVotiMutation.isPending) {
      console.log('⚠️ DEBUG CLIENT - removeLocal bloccato (isPending)');
      return;
    }
    // Apri il dialog di conferma invece di rimuovere immediatamente
    console.log('🔍 DEBUG CLIENT - Apertura dialog di rimozione per:', nome);
    setVotoToRemove(nome);
    setShowRemoveDialog(true);
    console.log('🔍 DEBUG CLIENT - showRemoveDialog impostato a true');
  };

  const confirmRemove = () => {
    if (!votoToRemove) return;
    const nuoviVoti = votingState.selectedVoti.filter(n => n !== votoToRemove);
    setVotingState(prev => ({
      ...prev,
      selectedVoti: nuoviVoti
    }));
    setShowRemoveDialog(false);
    setVotoToRemove(null);
    // Salva automaticamente dopo aver rimosso il voto
    setTimeout(() => {
      saveVotiMutation.mutate(nuoviVoti);
    }, 0);
  };

  const cancelRemove = () => {
    setShowRemoveDialog(false);
    setVotoToRemove(null);
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
            selectedVoti: nuoviVoti
          };
        } else {
          // Primo voto o aggiunta normale, salva automaticamente
          const nuoviVoti = [...prev.selectedVoti, nome];
          setTimeout(() => {
            saveVotiMutation.mutate(nuoviVoti);
          }, 0);
          return {
            ...prev,
            selectedVoti: nuoviVoti
          };
        }
      }
    });
  };

  const handleCreateCarcerato = async (data: CarceratoFormData) => {
    if (isSubmittingProposal) return;
    setIsSubmittingProposal(true);
    try {
      const response = await apiRequest("POST", "/api/grazia", {
        nome: data.nome,
        urlProva: data.urlProva,
      });
      if (!response?.ok || !response?.data?.success) {
        throw new Error(response?.data?.error || "Impossibile registrare la proposta");
      }
      toast({
        title: "Proposta registrata",
        description: "La richiesta è in attesa di revisione e non è ancora pubblica.",
      });
      hideForm();
    } catch (error: any) {
      toast({
        title: "Proposta non registrata",
        description: error?.message || "Riprova in un altro momento.",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingProposal(false);
    }
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
    handleCreateCarcerato,
    isSubmittingProposal,
    // Informazioni sui limiti
    currentVotes,
    limit,
    remainingVotes,
    hasReachedLimit,
    // Dialog di rimozione
    showRemoveDialog,
    votoToRemove,
    confirmRemove,
    cancelRemove
  };
};
