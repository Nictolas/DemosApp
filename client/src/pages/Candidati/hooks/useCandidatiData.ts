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
      console.log('🔍 DEBUG useCandidatiData - Response status:', response.status);
      
      if (!response.ok) throw new Error("Errore nel caricamento dei candidati");
      const result = await response.json();
      console.log('🔍 DEBUG useCandidatiData - Result:', result);
      
      // Gestisce la nuova struttura dell'API
      if (result.success && result.data) {
        console.log('🔍 DEBUG useCandidatiData - Dati restituiti:', result.data);
        return result.data;
      }
      
      // Fallback per struttura legacy
      if (Array.isArray(result?.candidati)) {
        const idMap: Record<string, string> = {};
        const candidati: any = {};
        console.log('🔍 DEBUG useCandidatiData - Fallback legacy');
        return { candidati, idMap };
      }
      
      // Fallback per struttura vuota
      console.log('🔍 DEBUG useCandidatiData - Fallback vuoto');
      return { candidati: {}, idMap: {} };
    },
    enabled: !!user,
  });
};
