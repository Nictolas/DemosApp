import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ConsensoGovernoData {
  mioConsenso: {
    risposta: string;
    timestamp: string;
  } | null;
  statistiche: {
    'Sì': number;
    'Non so': number;
    'No': number;
    totale: number;
  };
  blocco: {
    isBlocked: boolean;
    unlockDate: string | null;
  };
}

export const useConsensoGovernoData = (user: any) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query per ottenere i dati di consenso
  const { data, isLoading } = useQuery<ConsensoGovernoData>({
    queryKey: ['consensoGovernoData', user?.id],
    queryFn: async ({ signal }) => {
      const response = await apiRequest("GET", "/api/governo/consenso", undefined, undefined, signal);
      if (!response.ok) throw new Error("Errore nel caricamento dei dati di consenso del governo.");
      const result = await response.json();
      return result.data;
    },
    enabled: !!user?.id,
    refetchInterval: 30000, // Aggiorna ogni 30 secondi
  });

  // Mutazione per votare
  const voteMutation = useMutation({
    mutationFn: (risposta: string) => 
      apiRequest("POST", "/api/governo/consenso", { risposta }),
    onSuccess: () => {
      toast({ 
        title: "Voto salvato", 
        description: "Il tuo voto di consenso del governo è stato registrato con successo." 
      });
      queryClient.invalidateQueries({ queryKey: ['consensoGovernoData'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile salvare il voto di consenso del governo.", 
        variant: "destructive" 
      });
    }
  });

  return {
    data,
    isLoading,
    voteConsenso: voteMutation.mutate,
    isVoting: voteMutation.isPending
  };
};
