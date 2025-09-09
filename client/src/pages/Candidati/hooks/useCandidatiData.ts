import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ElezioniData } from "../types";

export const useCandidatiData = (user: any) => {
  return useQuery<ElezioniData>({
    queryKey: ['candidatiData'],
    queryFn: async () => {
      // Endpoint protetto: usa JWT per risalire all'utente corrente
      const response = await apiRequest("GET", `/api/elezioni-utente`);
      if (!response.ok) throw new Error("Errore nel caricamento dei candidati per le elezioni");
      const result = await response.json();
      
      console.log('🔍 DEBUG useCandidatiData - Risposta API:', result);
      
      // Gestisce la nuova struttura dell'API
      if (result.success && result.data) {
        console.log('🔍 DEBUG useCandidatiData - Dati ricevuti:', result.data);
        return result.data;
      }
      
      // Fallback per struttura legacy
      if (Array.isArray(result?.candidati)) {
        const idMap: Record<string, string> = {};
        const candidati: any = {};
        return { candidati, idMap };
      }
      
      // Fallback per struttura vuota - IMPORTANTE: restituisce sempre dati validi
      console.log('🔍 DEBUG useCandidatiData - Usando fallback vuoto');
      return { candidati: {}, idMap: {} };
    },
    enabled: !!user,
  });
};
