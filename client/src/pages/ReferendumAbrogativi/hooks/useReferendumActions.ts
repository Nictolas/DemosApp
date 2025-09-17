import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import apiRequest from "@/lib/api-request";
import { Referendum, ReferendumFormData, ReferendumAbrogativiState, QuorumChangeData } from "../types";
import { QUERY_KEYS, API_ENDPOINTS, MESSAGES } from "../constants";

export const useReferendumActions = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Stato locale per il form e la modifica
  const [state, setState] = useState<ReferendumAbrogativiState>({
    showForm: false,
    editReferendum: null
  });

  // Mutation per creare un nuovo referendum
  const createMutation = useMutation({
    mutationFn: async (data: ReferendumFormData) => {
      const response = await apiRequest("POST", API_ENDPOINTS.REFERENDUM_CREATE, data);
      if (!response.ok) throw new Error(MESSAGES.ERROR.CREATE);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REFERENDUM_LIST });
      toast({ title: "Successo", description: MESSAGES.SUCCESS.CREATED });
      setState(prev => ({ ...prev, showForm: false }));
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  // Mutation per aggiornare un referendum
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: ReferendumFormData }) => {
      const response = await apiRequest("PUT", API_ENDPOINTS.REFERENDUM_UPDATE(id), data);
      if (!response.ok) throw new Error(MESSAGES.ERROR.UPDATE);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REFERENDUM_LIST });
      toast({ title: "Successo", description: MESSAGES.SUCCESS.UPDATED });
      setState(prev => ({ ...prev, editReferendum: null }));
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  // Mutation per eliminare un referendum
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("DELETE", API_ENDPOINTS.REFERENDUM_DELETE(id));
      if (!response.ok) throw new Error(MESSAGES.ERROR.DELETE);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REFERENDUM_LIST });
      toast({ title: "Successo", description: MESSAGES.SUCCESS.DELETED });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  // Mutation per aggiornare il quorum
  const quorumMutation = useMutation({
    mutationFn: async ({ id, quorum }: QuorumChangeData) => {
      const response = await apiRequest("PATCH", API_ENDPOINTS.REFERENDUM_QUORUM(id), { quorum });
      if (!response.ok) throw new Error(MESSAGES.ERROR.QUORUM_UPDATE);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.REFERENDUM_LIST });
      toast({ title: "Successo", description: MESSAGES.SUCCESS.QUORUM_UPDATED });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message, variant: "destructive" });
    }
  });

  // Funzioni per gestire lo stato
  const showCreateForm = () => setState(prev => ({ ...prev, showForm: true }));
  const hideCreateForm = () => setState(prev => ({ ...prev, showForm: false }));
  
  const startEdit = (referendum: Referendum) => {
    setState(prev => ({ ...prev, editReferendum: referendum }));
  };
  
  const cancelEdit = () => {
    setState(prev => ({ ...prev, editReferendum: null }));
  };

  // Funzioni per le operazioni CRUD
  const handleCreate = (data: ReferendumFormData) => {
    createMutation.mutate(data);
  };

  const handleUpdate = (data: ReferendumFormData) => {
    if (state.editReferendum) {
      updateMutation.mutate({ id: state.editReferendum.id, data });
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  // Funzione per gestire il cambio quorum
  const handleQuorumChange = (id: string, quorum: 'ok' | 'pending' | 'no') => {
    quorumMutation.mutate({ id, quorum });
  };

  return {
    // Stato
    state,
    
    // Mutations
    createMutation,
    updateMutation,
    deleteMutation,
    quorumMutation,
    
    // Funzioni per lo stato
    showCreateForm,
    hideCreateForm,
    startEdit,
    cancelEdit,
    
    // Funzioni per le operazioni
    handleCreate,
    handleUpdate,
    handleDelete,
    handleQuorumChange
  };
};
