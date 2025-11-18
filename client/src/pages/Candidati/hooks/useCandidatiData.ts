import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CandidatiData } from "../types";

export const useCandidatiData = (user: any) => {
  return useQuery<CandidatiData>({
    queryKey: ['candidatiData'],
    queryFn: async () => {
      console.log('🔍 DEBUG useCandidatiData - Iniziando fetch dati candidati');
      
      // Endpoint protetto: usa JWT per risalire all'utente corrente
      const response = await apiRequest("GET", `/api/candidati`);
      console.log('🔍 DEBUG useCandidatiData - Response:', response);
      
      if (!response?.ok || !response?.data) {
        console.log('🔍 DEBUG useCandidatiData - Risposta non ok o dati mancanti');
        return { candidati: {}, idMap: {} };
      }
      
      const result = response.data;
      console.log('🔍 DEBUG useCandidatiData - result:', result);
      console.log('🔍 DEBUG useCandidatiData - result.success:', result?.success);
      console.log('🔍 DEBUG useCandidatiData - result.data:', result?.data);
      console.log('🔍 DEBUG useCandidatiData - result.candidati:', result?.candidati);
      
      // Gestisce la nuova struttura dell'API
      if (result?.success && result?.data) {
        console.log('🔍 DEBUG useCandidatiData - Dati restituiti (struttura success/data):', result.data);
        return result.data;
      }
      
      // Fallback per struttura legacy (se i dati sono direttamente nell'oggetto)
      if (result?.candidati && typeof result.candidati === 'object') {
        console.log('🔍 DEBUG useCandidatiData - Dati con struttura candidati/idMap');
        return {
          candidati: result.candidati || {},
          idMap: result.idMap || {}
        };
      }
      
      // Fallback per struttura vuota
      console.log('🔍 DEBUG useCandidatiData - Fallback vuoto, result:', JSON.stringify(result, null, 2));
      return { candidati: {}, idMap: {} };
    },
    enabled: !!user,
  });
};
