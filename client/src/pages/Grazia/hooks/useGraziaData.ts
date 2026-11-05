import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GraziaData } from "../types";
import { useToast } from "@/hooks/use-toast";
import { getRemainingVotes } from "@/config/votingLimits";

// Do not surface arbitrary API/body/transport errors: they can contain third-party names or technical details.
const GRAZIA_LOAD_ERROR = "Impossibile caricare la classifica. Riprova più tardi.";
const GRAZIA_SAVE_ERROR = "Impossibile salvare le richieste di grazia.";

export const useGraziaData = (user: any) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Personal voting data and the complete API response must never be logged.
  const { data, isLoading: isLoadingData, error } = useQuery<GraziaData>({
    // Keep each account's personal preferences in a distinct cache entry.
    queryKey: ['graziaData', user?.id ?? null],
    queryFn: async () => {
      try {
        const response = await apiRequest("GET", "/api/grazia");
        if (!response?.ok || !response?.data || response.data.success === false) {
          throw new Error(GRAZIA_LOAD_ERROR);
        }
        return response.data;
      } catch {
        // apiRequest can throw with raw response text. Never put it in React Query error state.
        throw new Error(GRAZIA_LOAD_ERROR);
      }
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });

  const saveVotiMutation = useMutation({
    mutationFn: async (voti: string[]) => {
      // POST body is necessary for the action, not for logs or error messages.
      try {
        const response = await apiRequest("POST", "/api/grazia/vota", { voti });
        if (!response?.ok || !response?.data || response.data.success === false) {
          throw new Error(GRAZIA_SAVE_ERROR);
        }
        return response.data;
      } catch {
        // The transport can throw arbitrary server text. Only expose a neutral message.
        throw new Error(GRAZIA_SAVE_ERROR);
      }
    },
    onSuccess: (_data, variables) => {
      const remainingVotes = getRemainingVotes('grazia', variables.length);
      toast({
        title: "Preferenze salvate",
        description: `Le tue richieste di grazia sono state aggiornate. Voti rimanenti: ${remainingVotes}`
      });
      queryClient.invalidateQueries({ queryKey: ['graziaData', user?.id ?? null] });
    },
    onError: () => {
      toast({
        title: "Errore",
        description: GRAZIA_SAVE_ERROR,
        variant: "destructive"
      });
    },
    onSettled: () => {
      // Dialog gestito automaticamente
    }
  });

  return { data, isLoadingData, error, saveVotiMutation };
};
