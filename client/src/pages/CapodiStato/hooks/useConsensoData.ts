import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

interface ConsensoData {
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

export const useConsensoData = (user: any) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query per ottenere i dati di consenso
  const { data, isLoading } = useQuery<ConsensoData>({
    queryKey: ['consensoData'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/capo-stato/consenso");
      if (!response.ok) throw new Error("Errore nel caricamento dei dati di consenso.");
      const result = await response.json();
      return result.data;
    },
    enabled: !!user,
    refetchInterval: 30000, // Aggiorna ogni 30 secondi
  });

  // Mutazione per votare
  const voteMutation = useMutation({
    mutationFn: (risposta: string) => 
      apiRequest("POST", "/api/capo-stato/consenso", { risposta }),
    onSuccess: () => {
      toast({ 
        title: "Voto salvato", 
        description: "Il tuo voto di consenso è stato registrato con successo." 
      });
      queryClient.invalidateQueries({ queryKey: ['consensoData'] });
    },
    onError: (error: any) => {
      toast({ 
        title: "Errore", 
        description: error.message || "Impossibile salvare il voto di consenso.", 
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
