import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { VotiData } from "../types";
import { useToast } from "@/hooks/use-toast";

export const useGovernoData = (user: any) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Query per caricare i dati
  const { data, isLoading: isLoadingData } = useQuery<VotiData>({
    queryKey: ['governoVoti'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/governo/voti");
      if (!response.ok) throw new Error("Errore nel caricamento dei dati del governo.");
      return response.json();
    },
    enabled: !!user
  });

  // Mutazione per salvare tutti i voti in blocco
  const saveVotiMutation = useMutation({
    mutationFn: (voti: { [categoria: string]: string }) => apiRequest("POST", "/api/governo/vota", { voti }),
    onSuccess: () => {
      toast({ title: "Preferenze salvate", description: "Le tue scelte per il governo sono state aggiornate." });
      queryClient.invalidateQueries({ queryKey: ['governoVoti'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile salvare le preferenze.", variant: "destructive" });
    }
  });

  return {
    data,
    isLoadingData,
    saveVotiMutation
  };
};
