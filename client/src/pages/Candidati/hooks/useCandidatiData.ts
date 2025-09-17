import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CandidatiData } from "../types";

export const useCandidatiData = (user: any) => {
  return useQuery<CandidatiData>({
    queryKey: ['candidatiData'],
    queryFn: async () => {
      // Endpoint protetto: usa JWT per risalire all'utente corrente
      const response = await apiRequest("GET", `/api/candidati`);
      if (!response.ok) throw new Error("Errore nel caricamento dei candidati");
      const result = await response.json();
      
      // Gestisce la nuova struttura dell'API
      if (result.success && result.data) {
        return result.data;
      }
      
      // Fallback per struttura legacy
      if (Array.isArray(result?.candidati)) {
        const idMap: Record<string, string> = {};
        const candidati: any = {};
        return { candidati, idMap };
      }
      
      // Fallback per struttura vuota
      return { candidati: {}, idMap: {} };
    },
    enabled: !!user,
  });
};
