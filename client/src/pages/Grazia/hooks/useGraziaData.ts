import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GraziaData } from "../types";

export const useGraziaData = (user: any) => {
  const queryClient = useQueryClient();

  // Query per caricare i dati
  const { data, isLoading: isLoadingData, error } = useQuery<GraziaData>({
    queryKey: ['graziaData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/grazia avviata');
      const response = await apiRequest("GET", "/api/grazia");
      console.log('🔍 DEBUG: Risposta ricevuta:', response);
      if (!response || !response.success) {
        const errorMsg = response?.error || "Errore nel caricamento dei dati grazia";
        console.error('❌ Errore API /api/grazia:', errorMsg);
        throw new Error(errorMsg);
      }
      console.log('✅ Dati grazia ricevuti:', response);
      return response;
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: (voti: string[]) => apiRequest("POST", "/api/grazia/vota", { voti }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['graziaData'] });
    },
    onError: (error: any) => {
      console.error('❌ Errore salvataggio voti:', error);
    }
  });

  return {
    data,
    isLoadingData,
    error,
    saveVotiMutation
  };
};
