import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AmnistiaData } from "../types";
import { useToast } from "@/hooks/use-toast";

export const useAmnistiaData = (user: any) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Query per caricare i dati
  const { data, isLoading: isLoadingData } = useQuery<AmnistiaData>({
    queryKey: ['amnistiaData'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/amnistia");
      if (!response.ok) throw new Error("Errore nel caricamento dei dati.");
      return response.json();
    },
    enabled: !!user
  });

  // Mutazione per aggiungere voto
  const addVoteMutation = useMutation({
    mutationFn: (legge: string) => apiRequest("POST", "/api/amnistia/vota", { legge }),
    onSuccess: () => {
      toast({ title: "Voto registrato", description: "Il tuo voto è stato registrato con successo." });
      queryClient.invalidateQueries({ queryKey: ['amnistiaData'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile registrare il voto.", variant: "destructive" });
    }
  });

  // Mutazione per rimuovere voto
  const removeVoteMutation = useMutation({
    mutationFn: (legge: string) => apiRequest("DELETE", "/api/amnistia/vota", { legge }),
    onSuccess: () => {
      toast({ title: "Voto rimosso", description: "Il tuo voto è stato rimosso con successo." });
      queryClient.invalidateQueries({ queryKey: ['amnistiaData'] });
    },
    onError: (error: any) => {
      toast({ title: "Errore", description: error.message || "Impossibile rimuovere il voto.", variant: "destructive" });
    }
  });

  return {
    data,
    isLoadingData,
    addVoteMutation,
    removeVoteMutation
  };
};
