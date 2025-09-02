import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { RappresentantiData } from "../types";

export const useRappresentantiData = (user: any) => {
  return useQuery<RappresentantiData>({
    queryKey: ['rappresentantiData'],
    queryFn: async () => {
      // Endpoint protetto: usa JWT per risalire all'utente corrente
      const response = await apiRequest("GET", `/api/rappresentanti`);
      if (!response.ok) throw new Error("Errore nel caricamento dei rappresentanti");
      const result = await response.json();
      
      // Gestisce la nuova struttura dell'API
      if (result.success && result.data) {
        return result.data;
      }
      
      // Fallback per struttura legacy
      if (Array.isArray(result?.candidati)) {
        const idMap: Record<string, string> = {};
        const rappresentanti: any = {};
        return { rappresentanti, idMap };
      }
      
      // Fallback per struttura vuota
      return { rappresentanti: {}, idMap: {} };
    },
    enabled: !!user,
  });
};
