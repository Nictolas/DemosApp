import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiRequest from "@/lib/api-request";
import { GraziaData } from "../types";

export const useGraziaData = (user: any) => {
  const queryClient = useQueryClient();

  // Query per caricare i dati
  const { data, isLoading: isLoadingData, error } = useQuery<GraziaData>({
    queryKey: ['graziaData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/grazia avviata');
      const response = await apiRequest("GET", "/grazia");
      console.log('🔍 DEBUG: Risposta ricevuta:', response.status);
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Errore API /grazia:', errorData);
        throw new Error(`Errore ${response.status}: ${errorData}`);
      }
      const result = await response.json();
      console.log('✅ Dati grazia ricevuti:', result);
      return result;
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
