import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiRequest from "@/lib/api-request";
import { useToast } from "@/hooks/use-toast";
import { MinisteroCreateData, MinisteroUpdateData } from "../types";
import { API_ENDPOINTS, QUERY_KEYS, TOAST_MESSAGES } from "../constants";

export function useMinisteriActions() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const addMutation = useMutation({
    mutationFn: (newMinistero: MinisteroCreateData) => 
      apiRequest("POST", API_ENDPOINTS.MINISTERI, newMinistero),
    onSuccess: () => {
      toast({ title: "Successo", description: TOAST_MESSAGES.SUCCESS.ADD });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MINISTERI });
    },
    onError: () => 
      toast({ 
        title: "Errore", 
        description: TOAST_MESSAGES.ERROR.ADD, 
        variant: "destructive" 
      }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: MinisteroUpdateData }) => 
      apiRequest("PUT", API_ENDPOINTS.MINISTERI_BY_ID(id), data),
    onSuccess: () => {
      toast({ title: "Successo", description: TOAST_MESSAGES.SUCCESS.UPDATE });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MINISTERI });
    },
    onError: () => 
      toast({ 
        title: "Errore", 
        description: TOAST_MESSAGES.ERROR.UPDATE, 
        variant: "destructive" 
      }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => 
      apiRequest("DELETE", API_ENDPOINTS.MINISTERI_BY_ID(id)),
    onSuccess: () => {
      toast({ title: "Successo", description: TOAST_MESSAGES.SUCCESS.DELETE });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.MINISTERI });
    },
    onError: () => 
      toast({ 
        title: "Errore", 
        description: TOAST_MESSAGES.ERROR.DELETE, 
        variant: "destructive" 
      }),
  });

  return {
    addMutation,
    updateMutation,
    deleteMutation,
  };
}
