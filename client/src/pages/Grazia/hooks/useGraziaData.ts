import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GraziaData } from "../types";
import { useToast } from "@/hooks/use-toast";
import { getRemainingVotes } from "@/config/votingLimits";

export const useGraziaData = (user: any) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query per caricare i dati
  const { data, isLoading: isLoadingData, error } = useQuery<GraziaData>({
    queryKey: ['graziaData', user?.id],
    queryFn: async ({ signal }) => {
      try {
        const response = await apiRequest("GET", "/api/grazia", undefined, undefined, signal);
        
        if (!response?.ok || !response?.data) {
          const errorMsg = response?.data?.error || response?.data?.message || "Errore nel caricamento dei dati grazia";
          throw new Error(errorMsg);
        }
        
        const result = response.data;
        
        if (!result || result.success === false) {
          const errorMsg = result?.error || result?.message || "Errore nel caricamento dei dati grazia";
          throw new Error(errorMsg);
        }
        
        return result;
      } catch (err: any) {
        throw err;
      }
    },
    enabled: !!user?.id && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: async (voti: string[]) => {
      const response = await apiRequest("POST", "/api/grazia/vota", { voti });
      
      if (!response?.ok || !response?.data) {
        const errorMsg = response?.data?.error || response?.data?.message || "Errore nel salvataggio dei voti";
        throw new Error(errorMsg);
      }
      
      const result = response.data;
      if (result?.success === false) {
        const errorMsg = result?.error || result?.message || "Errore nel salvataggio dei voti";
        throw new Error(errorMsg);
      }
      
      return result;
    },
    onSuccess: (data, variables) => {
      const remainingVotes = getRemainingVotes('grazia', variables.length);
      toast({ 
        title: "Preferenze salvate", 
        description: `Le tue richieste di grazia sono state aggiornate. Voti rimanenti: ${remainingVotes}` 
      });
      queryClient.invalidateQueries({ queryKey: ['graziaData'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile salvare le richieste di grazia.", 
        variant: "destructive" 
      });
    },
    onSettled: () => {
      // Dialog gestito automaticamente
    }
  });

  return {
    data,
    isLoadingData,
    error,
    saveVotiMutation
  };
};
