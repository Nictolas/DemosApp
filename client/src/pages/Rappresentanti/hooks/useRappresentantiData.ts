import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { RappresentantiData } from "../types";

export const useRappresentantiData = (user: any) => {
  return useQuery<RappresentantiData>({
    queryKey: ['rappresentantiData'],
    queryFn: async () => {
      console.log('🔍 DEBUG useRappresentantiData - Iniziando fetch dati rappresentanti');
      
      // Endpoint protetto: usa JWT per risalire all'utente corrente
      const response = await apiRequest("GET", `/api/rappresentanti`);
      console.log('🔍 DEBUG useRappresentantiData - Response:', response);
      
      if (!response?.ok || !response?.data) {
        console.log('🔍 DEBUG useRappresentantiData - Risposta non ok o dati mancanti');
        return { rappresentanti: {}, idMap: {} };
      }
      
      const result = response.data;
      console.log('🔍 DEBUG useRappresentantiData - result:', result);
      console.log('🔍 DEBUG useRappresentantiData - result.success:', result?.success);
      console.log('🔍 DEBUG useRappresentantiData - result.data:', result?.data);
      console.log('🔍 DEBUG useRappresentantiData - result.rappresentanti:', result?.rappresentanti);
      
      // Gestisce la nuova struttura dell'API
      if (result?.success && result?.data) {
        console.log('🔍 DEBUG useRappresentantiData - Dati restituiti (struttura success/data):', result.data);
        return result.data;
      }
      
      // Fallback per struttura legacy (se i dati sono direttamente nell'oggetto)
      if (result?.rappresentanti && typeof result.rappresentanti === 'object') {
        console.log('🔍 DEBUG useRappresentantiData - Dati con struttura rappresentanti/idMap');
        return {
          rappresentanti: result.rappresentanti || {},
          idMap: result.idMap || {}
        };
      }
      
      // Fallback per struttura vuota
      console.log('🔍 DEBUG useRappresentantiData - Fallback vuoto, result:', JSON.stringify(result, null, 2));
      return { rappresentanti: {}, idMap: {} };
    },
    enabled: !!user,
  });
};
