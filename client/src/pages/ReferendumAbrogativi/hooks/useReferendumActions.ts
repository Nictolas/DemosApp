import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Referendum, ReferendumFormData, ReferendumAbrogativiState, QUERY_KEYS, API_ENDPOINTS, MESSAGES } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useReferendumActions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [state, setState] = useState<ReferendumAbrogativiState>({
    showForm: false,
    editReferendum: null,
    viewReferendum: null
  });

  // Funzione helper per ricaricare i dati
  const invalidateAndRefetch = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REFERENDUM_LIST });

  // Mutazioni gestite da React Query
  const addMutation = useMutation({
    mutationFn: (data: ReferendumFormData) => apiRequest("POST", API_ENDPOINTS.REFERENDUM_CREATE, data),
    retry: false, // Disabilita retry automatico per prevenire doppi submit
    onSuccess: () => {
      toast({ title: "Successo", description: MESSAGES.SUCCESS.CREATED });
      setState(prev => ({ ...prev, showForm: false }));
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || MESSAGES.ERROR.CREATE, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (data: ReferendumFormData & { quorum?: string }) => apiRequest("PUT", API_ENDPOINTS.REFERENDUM_UPDATE(state.editReferendum?.id || ""), data),
    onSuccess: () => {
      toast({ title: "Successo", description: MESSAGES.SUCCESS.UPDATED });
      setState(prev => ({ ...prev, editReferendum: null }));
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || MESSAGES.ERROR.UPDATE, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", API_ENDPOINTS.REFERENDUM_DELETE(id)),
    onSuccess: () => {
      toast({ title: "Successo", description: MESSAGES.SUCCESS.DELETED });
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || MESSAGES.ERROR.DELETE, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/referendum-abrogativi/${id}/accetta`),
    onSuccess: () => {
      toast({ title: "Successo", description: "Referendum approvato con successo!" });
      invalidateAndRefetch();
    },
    onError: async (e: any) => {
      const errorMsg = e instanceof Response ? await e.text() : e.message;
      toast({ title: "Errore", description: errorMsg || "Errore nell'approvazione", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/referendum-abrogativi/${id}/rifiuta`),
    onSuccess: () => {
      toast({ title: "Successo", description: "Referendum rifiutato e eliminato" });
      invalidateAndRefetch();
    },
    onError: async (e: any) => {
      const errorMsg = e instanceof Response ? await e.text() : e.message;
      toast({ title: "Errore", description: errorMsg || "Errore nel rifiuto", variant: "destructive" });
    },
  });

  // Funzioni per gestire lo stato
  const showCreateForm = () => setState(prev => ({ ...prev, showForm: true }));
  const hideCreateForm = () => setState(prev => ({ ...prev, showForm: false }));
  const startEdit = (referendum: Referendum) => setState(prev => ({ ...prev, editReferendum: referendum }));
  const cancelEdit = () => setState(prev => ({ ...prev, editReferendum: null }));
  const startEditView = (referendum: Referendum) => setState(prev => ({ ...prev, viewReferendum: referendum }));
  const closeView = () => setState(prev => ({ ...prev, viewReferendum: null }));

  // Funzioni per gestire le azioni
  const handleCreate = (data: ReferendumFormData, currentProposals: number = 0) => {
    // Controlla il limite di proposte
    const limit = getVotingLimit('referendum_abrogativi_proposti');
    if (hasReachedVotingLimit('referendum_abrogativi_proposti', currentProposals)) {
      toast({ 
        title: "Limite proposte raggiunto", 
        description: `Puoi proporre solo ${limit} referendum abrogativo. Rimuovi una proposta esistente per proporne una nuova.`,
        variant: "destructive"
      });
      return;
    }
    addMutation.mutate(data);
  };
  const handleUpdate = (data: ReferendumFormData) => editMutation.mutate(data);
  const handleDelete = (id: string) => deleteMutation.mutate(id);
  const handleApprove = (id: string) => approveMutation.mutate(id);
  const handleReject = (id: string) => rejectMutation.mutate(id);

  return {
    state,
    addMutation,
    editMutation,
    deleteMutation,
    approveMutation,
    rejectMutation,
    showCreateForm,
    hideCreateForm,
    startEdit,
    cancelEdit,
    startEditView,
    closeView,
    handleCreate,
    handleUpdate,
    handleDelete,
    handleApprove,
    handleReject
  };
};