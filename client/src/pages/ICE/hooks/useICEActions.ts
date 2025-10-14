import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ICE, ICEFormData, ICEState } from "../types";
import { QUERY_KEYS, API_ENDPOINTS, MESSAGES } from "../constants";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useICEActions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [state, setState] = useState<ICEState>({
    showForm: false,
    editICE: null,
    viewICE: null
  });

  // Funzione helper per ricaricare i dati
  const invalidateAndRefetch = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ICE_LIST });

  // Mutazioni gestite da React Query
  const addMutation = useMutation({
    mutationFn: (data: ICEFormData) => apiRequest("POST", API_ENDPOINTS.ICE_CREATE, data),
    onSuccess: () => {
      toast({ title: "Successo", description: MESSAGES.SUCCESS.CREATED });
      setState(prev => ({ ...prev, showForm: false }));
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || MESSAGES.ERROR.CREATE, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (data: ICEFormData & { quorum?: string }) => apiRequest("PUT", API_ENDPOINTS.ICE_UPDATE(state.editICE?.id || ""), data),
    onSuccess: () => {
      toast({ title: "Successo", description: MESSAGES.SUCCESS.UPDATED });
      setState(prev => ({ ...prev, editICE: null }));
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || MESSAGES.ERROR.UPDATE, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", API_ENDPOINTS.ICE_DELETE(id)),
    onSuccess: () => {
      toast({ title: "Successo", description: MESSAGES.SUCCESS.DELETED });
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || MESSAGES.ERROR.DELETE, variant: "destructive" }),
  });

  // Funzioni per gestire lo stato
  const showCreateForm = () => setState(prev => ({ ...prev, showForm: true }));
  const hideCreateForm = () => setState(prev => ({ ...prev, showForm: false }));
  const startEdit = (ice: ICE) => setState(prev => ({ ...prev, editICE: ice }));
  const cancelEdit = () => setState(prev => ({ ...prev, editICE: null }));
  const startEditView = (ice: ICE) => setState(prev => ({ ...prev, viewICE: ice }));
  const closeView = () => setState(prev => ({ ...prev, viewICE: null }));

  // Funzioni per gestire le azioni
  const handleCreate = (data: ICEFormData, currentProposals: number = 0) => {
    // Controlla il limite di proposte
    const limit = getVotingLimit('ice_proposti');
    if (hasReachedVotingLimit('ice_proposti', currentProposals)) {
      toast({ 
        title: "Limite proposte raggiunto", 
        description: `Puoi proporre solo ${limit} ICE. Rimuovi una proposta esistente per proporne una nuova.`,
        variant: "destructive"
      });
      return;
    }
    addMutation.mutate(data);
  };
  const handleUpdate = (data: ICEFormData) => editMutation.mutate(data);
  const handleDelete = (id: string) => deleteMutation.mutate(id);

  return {
    state,
    addMutation,
    editMutation,
    deleteMutation,
    showCreateForm,
    hideCreateForm,
    startEdit,
    cancelEdit,
    startEditView,
    closeView,
    handleCreate,
    handleUpdate,
    handleDelete
  };
};
