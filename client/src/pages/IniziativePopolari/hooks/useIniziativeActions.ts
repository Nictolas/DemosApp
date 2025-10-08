import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { IniziativaPopolare, IniziativaFormData, IniziativaState } from "../types";
import { QUERY_KEYS, API_ENDPOINTS, MESSAGES } from "../constants";

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
    onSuccess: () => {
      toast({ title: "Successo", description: MESSAGES.SUCCESS.CREATED });
      setState(prev => ({ ...prev, showForm: false }));
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || MESSAGES.ERROR.CREATE, variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (data: IniziativaFormData & { quorum?: string }) => apiRequest("PUT", API_ENDPOINTS.INIZIATIVE_UPDATE(state.editIniziativa?.id || ""), data),
    onSuccess: () => {
      toast({ title: "Successo", description: MESSAGES.SUCCESS.UPDATED });
      setState(prev => ({ ...prev, editIniziativa: null }));
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || MESSAGES.ERROR.UPDATE, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", API_ENDPOINTS.INIZIATIVE_DELETE(id)),
    onSuccess: () => {
      toast({ title: "Successo", description: MESSAGES.SUCCESS.DELETED });
      invalidateAndRefetch();
    },
    onError: (e: any) => toast({ title: "Errore", description: e.message || MESSAGES.ERROR.DELETE, variant: "destructive" }),
  });

  // Funzioni per gestire lo stato
  const showCreateForm = () => setState(prev => ({ ...prev, showForm: true }));
  const hideCreateForm = () => setState(prev => ({ ...prev, showForm: false }));
  const startEdit = (iniziativa: IniziativaPopolare) => setState(prev => ({ ...prev, editIniziativa: iniziativa }));
  const cancelEdit = () => setState(prev => ({ ...prev, editIniziativa: null }));
  const startEditView = (iniziativa: IniziativaPopolare) => setState(prev => ({ ...prev, viewIniziativa: iniziativa }));
  const closeView = () => setState(prev => ({ ...prev, viewIniziativa: null }));

  // Funzioni per gestire le azioni
  const handleCreate = (data: IniziativaFormData) => addMutation.mutate(data);
  const handleUpdate = (data: IniziativaFormData) => editMutation.mutate(data);
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
