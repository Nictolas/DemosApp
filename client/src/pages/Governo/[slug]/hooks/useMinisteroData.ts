import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { MinisteroData } from "../types";
import { useToast } from "@/hooks/use-toast";

export const useMinisteroData = (user: any, categoria?: string) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query per caricare i dati del ministero specifico
  const { data, isLoading, isError } = useQuery<MinisteroData>({
    queryKey: ['ministeroVoti', categoria],
    queryFn: async () => {
      console.log('🔍 DEBUG Frontend - Chiamata API per categoria:', categoria);
      // apiRequest gestisce già il controllo errori e il parsing JSON
      const result = await apiRequest("GET", `/api/governo/ministro/${categoria}/voti`);
      console.log('🔍 DEBUG Frontend - Risposta API ricevuta:', result);
      return result; // Restituisci direttamente il risultato già parsato
    },
    enabled: !!user && !!categoria
  });

  // Mutazione per salvare i voti del ministero
  const saveVotiMutation = useMutation({
    mutationFn: (voti: string[]) => apiRequest("POST", `/api/governo/ministro/${categoria}/vota`, { voti }),
    onSuccess: () => {
      toast({ title: "Preferenze salvate", description: "Le tue scelte per questo ministero sono state aggiornate." });
      queryClient.invalidateQueries({ queryKey: ['ministeroVoti', categoria] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare le preferenze.", variant: "destructive" });
    }
  });

  return {
    data,
    isLoading,
    isError,
    saveVotiMutation
  };
};
