import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { IniziativaPopolare, IniziativaFormData, IniziativaState } from "../types";
import { QUERY_KEYS, API_ENDPOINTS, MESSAGES } from "../constants";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useIniziativeActions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [state, setState] = useState<IniziativaState>({
    showForm: false,
    editIniziativa: null,
    viewIniziativa: null
  });

  // Funzione helper per ricaricare i dati
  const invalidateAndRefetch = () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.INIZIATIVE_LIST });

  // Mutazioni gestite da React Query
  const addMutation = useMutation({
    mutationFn: (data: IniziativaFormData) => apiRequest("POST", API_ENDPOINTS.INIZIATIVE_CREATE, data),
    retry: false, // Disabilita retry automatico per prevenire doppi submit
    onSuccess: () => {
      toast({ title: "Successo", description: MESSAGES.SUCCESS.CREATED });
      setState(prev => ({ ...prev, showForm: false }));
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || MESSAGES.ERROR.CREATE, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (data: IniziativaFormData & { quorum?: string }) => {
      const id = state.editIniziativa?.id;
      if (!id) {
        throw new Error("ID iniziativa non trovato");
      }
      console.log('🔍 editMutation - Inizio chiamata API:', { id, url: API_ENDPOINTS.INIZIATIVE_UPDATE(id), data });
      return apiRequest("PUT", API_ENDPOINTS.INIZIATIVE_UPDATE(id), data);
    },
    onSuccess: () => {
      console.log('✅ editMutation - onSuccess chiamato');
      toast({ title: "Successo", description: MESSAGES.SUCCESS.UPDATED });
      setState(prev => ({ ...prev, editIniziativa: null }));
      invalidateAndRefetch();
    },
    onError: (e: any) => {
      console.error('❌ editMutation - onError chiamato:', e);
      toast({ title: "Errore", description: e.message || MESSAGES.ERROR.UPDATE, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", API_ENDPOINTS.INIZIATIVE_DELETE(id)),
    onSuccess: () => {
      toast({ title: "Successo", description: MESSAGES.SUCCESS.DELETED });
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || MESSAGES.ERROR.DELETE, variant: "destructive" }),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/iniziative-popolari/${id}/accetta`),
    onSuccess: () => {
      toast({ title: "Successo", description: "Iniziativa approvata con successo!" });
      invalidateAndRefetch();
    },
    onError: async (e: any) => {
      const errorMsg = e instanceof Response ? await e.text() : e.message;
      toast({ title: "Errore", description: errorMsg || "Errore nell'approvazione", variant: "destructive" });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: (id: string) => apiRequest("POST", `/api/iniziative-popolari/${id}/rifiuta`),
    onSuccess: () => {
      toast({ title: "Successo", description: "Iniziativa rifiutata e eliminata" });
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
  const startEdit = (iniziativa: IniziativaPopolare) => setState(prev => ({ ...prev, editIniziativa: iniziativa }));
  const cancelEdit = () => setState(prev => ({ ...prev, editIniziativa: null }));
  const startEditView = (iniziativa: IniziativaPopolare) => setState(prev => ({ ...prev, viewIniziativa: iniziativa }));
  const closeView = () => setState(prev => ({ ...prev, viewIniziativa: null }));

  // Funzioni per gestire le azioni
  const handleCreate = (data: IniziativaFormData, currentProposals: number = 0) => {
    // Controlla il limite di proposte (ora controllato anche lato backend)
    const limit = getVotingLimit('iniziative_popolari_proposte');
    if (hasReachedVotingLimit('iniziative_popolari_proposte', currentProposals)) {
      toast({ 
        title: "Limite proposte raggiunto", 
        description: `Puoi proporre solo ${limit} iniziativa popolare. Rimuovi una proposta esistente per proporne una nuova.`,
        variant: "destructive"
      });
      return;
    }
    addMutation.mutate(data);
  };
  const handleUpdate = (data: IniziativaFormData & { quorum?: string; id?: string }) => {
    console.log('🔍 handleUpdate chiamato:', { data, editMutationPending: editMutation.isPending, stateEditId: state.editIniziativa?.id });
    
    if (editMutation.isPending) {
      console.warn('⚠️ handleUpdate - Mutation già in corso, ignoro');
      return; // Evita chiamate multiple
    }
    
    if (!state.editIniziativa?.id) {
      console.error('❌ handleUpdate - ID non trovato nello state');
      toast({ title: "Errore", description: "ID iniziativa non trovato", variant: "destructive" });
      return;
    }
    
    // Rimuove l'id dai dati prima di inviare (se presente)
    const { id: idField, ...dataWithoutId } = data;
    console.log('🔍 handleUpdate - Chiamando mutation con:', { data: dataWithoutId });
    
    editMutation.mutate(dataWithoutId);
  };
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
