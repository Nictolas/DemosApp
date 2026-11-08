import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { RappresentantiData } from "../types";

export const useRappresentantiData = (user: any) => {
  return useQuery<RappresentantiData>({
    queryKey: ['rappresentantiData'],
    queryFn: async () => {
      
      // Endpoint protetto: usa JWT per risalire all'utente corrente
      const response = await apiRequest("GET", `/api/rappresentanti`);
      
      if (!response?.ok || !response?.data) {
        return { rappresentanti: {}, idMap: {} };
      }
      
      const result = response.data;
      
      // Gestisce la nuova struttura dell'API
      if (result?.success && result?.data) {
        return result.data;
      }
      
      // Fallback per struttura legacy (se i dati sono direttamente nell'oggetto)
      if (result?.rappresentanti && typeof result.rappresentanti === 'object') {
        return {
          rappresentanti: result.rappresentanti || {},
          idMap: result.idMap || {}
        };
      }
      
      // Fallback per struttura vuota
      return { rappresentanti: {}, idMap: {} };
    },
    enabled: !!user,
  });
};
