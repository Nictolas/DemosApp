import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GraziaData } from "../types";
import { useToast } from "@/hooks/use-toast";
import { getRemainingVotes } from "@/config/votingLimits";

export const useGraziaData = (user: any) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Personal voting data and the complete API response must never be logged.
  const { data, isLoading: isLoadingData, error } = useQuery<GraziaData>({
    // Keep each account's personal preferences in a distinct cache entry.
    queryKey: ['graziaData', user?.id ?? null],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/grazia");
      if (!response?.ok || !response?.data) {
        throw new Error(response?.data?.error || response?.data?.message || "Errore nel caricamento dei dati grazia");
      }
      const result = response.data;
      if (result.success === false) {
        throw new Error(result.error || result.message || "Errore nel caricamento dei dati grazia");
      }
      return result;
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });

  const saveVotiMutation = useMutation({
    mutationFn: async (voti: string[]) => {
      // POST body is necessary for the user's action, but never recorded
      // in browser debug output or third-party telemetry here.
      const response = await apiRequest("POST", "/api/grazia/vota", { voti });
      if (!response?.ok || !response?.data) {
        throw new Error(response?.data?.error || response?.data?.message || "Errore nel salvataggio dei voti");
      }
      const result = response.data;
      if (result.success === false) {
        throw new Error(result.error || result.message || "Errore nel salvataggio dei voti");
      }
      return result;
    },
    onSuccess: (_data, variables) => {
      const remainingVotes = getRemainingVotes('grazia', variables.length);
      toast({
        title: "Preferenze salvate",
        description: `Le tue richieste di grazia sono state aggiornate. Voti rimanenti: ${remainingVotes}`
      });
      queryClient.invalidateQueries({ queryKey: ['graziaData', user?.id ?? null] });
    },
    onError: (error: any) => {
      // Show the existing user-facing message without logging raw errors.
      toast({
        title: "Errore",
        description: error?.message || "Impossibile salvare le richieste di grazia.",
        variant: "destructive"
      });
    },
    onSettled: () => {
      // Dialog gestito automaticamente
    }
  });

  return { data, isLoadingData, error, saveVotiMutation };
};
