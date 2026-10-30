import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Opinione, OpinioneProposta } from "./types";

export const useOpinioniData = () => {
  // Caricamento opinioni ufficiali
  const { data: opinioniResponse, isLoading, isError: isOpinioniError } = useQuery<{success: boolean, data: Opinione[]}>({
    queryKey: ['opinioni'],
    queryFn: async () => {
      console.log('🔍 DEBUG - Chiamata API /api/opinioni');
      const response = await apiRequest('GET', '/api/opinioni');
      console.log('🔍 DEBUG - Dati ricevuti:', response);
      
      // apiRequest restituisce { ok, status, data, json }
      // response.data contiene la risposta dell'API che ha struttura { success, data: [...] }
      if (!response?.ok || !response?.data) {
        throw new Error(response?.data?.error || 'Errore nel caricamento delle opinioni');
      }
      
      const apiData = response.data;
      if (apiData.success === false) {
        throw new Error(apiData.error || 'Errore nel caricamento delle opinioni');
      }
      
      // Mappa i gradi da lettere a nomi completi se necessario
      const opinioni = (apiData.data || []).map((op: any) => {
        const gradoMapping: Record<string, string> = {
          'E': 'Europeo',
          'N': 'Nazionale',
          'R': 'Regionale',
          'CO': 'Comunale'
        };
        
        const mappedGradi = op.gradi_opinione?.map((g: string) => 
          gradoMapping[g] || g
        ) || [];
        
        return {
          ...op,
          gradi_opinione: mappedGradi
        };
      });
      
      return { success: true, data: opinioni };
    }
  });

  // Caricamento opinioni proposte
  const { data: proposteResponse, isLoading: isLoadingProposte, isError: isProposteError } = useQuery<{success: boolean, data: OpinioneProposta[]}>({
    queryKey: ['opinioniProposte'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/opinioni-proposte');
      
      if (!response?.ok || !response?.data) {
        throw new Error(response?.data?.error || 'Errore nel caricamento delle proposte');
      }
      
      const apiData = response.data;
      if (apiData.success === false) {
        throw new Error(apiData.error || 'Errore nel caricamento delle proposte');
      }
      
      return { success: true, data: apiData.data || [] };
    }
  });

  // Estrai i dati con fallback sicuro
  const opinioni = opinioniResponse?.data || [];
  const proposte = proposteResponse?.data || [];

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

  // Mutazioni per le opinioni proposte
  const processPropostaMutation = useMutation({
    mutationFn: ({ id }: { id: string; action: 'rifiuta' }) => apiRequest('DELETE', `/api/opinioni-proposte/${id}`),
    onSuccess: () => { 
      toast({ title: "Successo", description: 'Proposta rifiutata.' }); 
      invalidateAll(); 
    },
    onError: () => toast({ title: "Errore", description: "Impossibile processare la proposta.", variant: "destructive" }),
  });

  return { processPropostaMutation };
};
