import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { GraziaData } from "../types";

export const useGraziaData = (user: any) => {
  const queryClient = useQueryClient();

  // Query per caricare i dati
  const { data, isLoading: isLoadingData, error } = useQuery<GraziaData>({
    queryKey: ['graziaData'],
    queryFn: async () => {
      try {
        console.log('🔍 DEBUG useGraziaData - Inizio fetch');
        const response = await apiRequest("GET", "/api/grazia");
        console.log('🔍 DEBUG useGraziaData - Response completa:', response);
        console.log('🔍 DEBUG useGraziaData - response.ok:', response?.ok);
        console.log('🔍 DEBUG useGraziaData - response.status:', response?.status);
        console.log('🔍 DEBUG useGraziaData - response.data:', response?.data);
        
        if (!response?.ok || !response?.data) {
          const errorMsg = response?.data?.error || response?.data?.message || "Errore nel caricamento dei dati grazia";
          console.error('❌ DEBUG useGraziaData - Errore response (non ok o dati mancanti):', errorMsg);
          throw new Error(errorMsg);
        }
        
        const result = response.data;
        console.log('🔍 DEBUG useGraziaData - result:', result);
        console.log('🔍 DEBUG useGraziaData - result.success:', result?.success);
        
        if (!result || result.success === false) {
          const errorMsg = result?.error || result?.message || "Errore nel caricamento dei dati grazia";
          console.error('❌ DEBUG useGraziaData - Errore result (success false o result null):', errorMsg);
          throw new Error(errorMsg);
        }
        
        console.log('✅ DEBUG useGraziaData - Restituendo result:', result);
        return result;
      } catch (err: any) {
        console.error('❌ DEBUG useGraziaData - Errore catturato:', err);
        console.error('❌ DEBUG useGraziaData - Errore message:', err?.message);
        throw err;
      }
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Mutazione per salvare i voti
  const saveVotiMutation = useMutation({
    mutationFn: async (voti: string[]) => {
      console.log('🔍 DEBUG saveVotiMutation - Inizio salvataggio voti:', voti);
      const response = await apiRequest("POST", "/api/grazia/vota", { voti });
      console.log('🔍 DEBUG saveVotiMutation - Response:', response);
      
      if (!response?.ok || !response?.data) {
        const errorMsg = response?.data?.error || response?.data?.message || "Errore nel salvataggio dei voti";
        console.error('❌ DEBUG saveVotiMutation - Errore response:', errorMsg);
        throw new Error(errorMsg);
      }
      
      const result = response.data;
      if (result?.success === false) {
        const errorMsg = result?.error || result?.message || "Errore nel salvataggio dei voti";
        console.error('❌ DEBUG saveVotiMutation - Errore result:', errorMsg);
        throw new Error(errorMsg);
      }
      
      console.log('✅ DEBUG saveVotiMutation - Voti salvati con successo');
      return result;
    },
    onSuccess: () => {
      console.log('✅ DEBUG saveVotiMutation - onSuccess chiamato, invalidando query');
      queryClient.invalidateQueries({ queryKey: ['graziaData'] });
    },
    onError: (error: any) => {
      console.error('❌ DEBUG saveVotiMutation - onError:', error);
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
