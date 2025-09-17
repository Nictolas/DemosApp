import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiRequest from "@/lib/api-request";
import { useToast } from "@/hooks/use-toast";
import { Opinione, OpinioneProposta } from "./types";

export const useOpinioniData = () => {
  // Caricamento opinioni ufficiali
  const { data: opinioniResponse, isLoading, isError: isOpinioniError } = useQuery<{success: boolean, data: Opinione[]}>({
    queryKey: ['opinioni'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/opinioni');
      if (!response.ok) throw new Error('Failed to fetch opinioni');
      return response.json();
    }
  });

  // Caricamento opinioni proposte
  const { data: proposteResponse, isLoading: isLoadingProposte, isError: isProposteError } = useQuery<{success: boolean, data: OpinioneProposta[]}>({
    queryKey: ['opinioniProposte'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/opinioni-proposte');
      if (!response.ok) throw new Error('Failed to fetch proposte');
      return response.json();
    }
  });

  // Estrai i dati con fallback sicuro
  const opinioni = opinioniResponse?.data || opinioniResponse || [];
  const proposte = proposteResponse?.data || proposteResponse || [];

  return {
    opinioni,
    proposte,
    isLoading,
    isLoadingProposte,
    isOpinioniError,
    isProposteError
  };
};

export const useOpinioniMutations = () => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Funzione helper per invalidare e ricaricare tutte le query
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['opinioni'] });
    queryClient.invalidateQueries({ queryKey: ['opinioniProposte'] });
  };

  // Mutazioni per le opinioni ufficiali
  const addMutation = useMutation({
    mutationFn: (newData: { id: string; text: string; gradi_opinione: string[] }) => 
      apiRequest('POST', '/api/opinioni', newData),
    onSuccess: () => { 
      toast({ title: "Successo", description: "Opinione aggiunta." }); 
      invalidateAll(); 
    },
    onError: () => toast({ title: "Errore", description: "Impossibile aggiungere l'opinione.", variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/opinioni/${id}`),
    onSuccess: () => { 
      toast({ title: "Successo", description: "Opinione eliminata." }); 
      invalidateAll(); 
    },
    onError: () => toast({ title: "Errore", description: "Impossibile eliminare l'opinione.", variant: "destructive" }),
  });

  const editMutation = useMutation({
    mutationFn: (updatedData: { id: string; text: string; gradi_opinione: string[] }) => 
      apiRequest('PUT', `/api/opinioni/${updatedData.id}`, { 
        text: updatedData.text, 
        gradi_opinione: updatedData.gradi_opinione 
      }),
    onSuccess: () => { 
      toast({ title: "Successo", description: "Opinione aggiornata." }); 
      invalidateAll(); 
    },
    onError: () => toast({ title: "Errore", description: "Impossibile aggiornare l'opinione.", variant: "destructive" }),
  });

  // Mutazioni per le opinioni proposte
  const processPropostaMutation = useMutation({
    mutationFn: ({ id, action }: { id: string; action: 'accetta' | 'rifiuta' }) => {
      const url = action === 'accetta' ? `/api/opinioni-proposte/${id}/accetta` : `/api/opinioni-proposte/${id}`;
      const method = action === 'accetta' ? 'POST' : 'DELETE';
      return apiRequest(method, url);
    },
    onSuccess: (_, {action}) => { 
      toast({ title: "Successo", description: `Proposta ${action === 'accetta' ? 'accettata' : 'rifiutata'}.` }); 
      invalidateAll(); 
    },
    onError: () => toast({ title: "Errore", description: "Impossibile processare la proposta.", variant: "destructive" }),
  });

  return {
    addMutation,
    deleteMutation,
    editMutation,
    processPropostaMutation
  };
};
