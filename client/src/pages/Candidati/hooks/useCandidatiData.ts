import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ElezioniData } from "../types";

export const useCandidatiData = (user: any) => {
  return useQuery<ElezioniData>({
    queryKey: ['candidatiData'],
    queryFn: async () => {
      // Endpoint principale per candidati (identico a rappresentanti)
      const response = await apiRequest("GET", `/api/candidati`);
      if (!response.ok) throw new Error("Errore nel caricamento dei candidati");
      const result = await response.json();
      
      // Gestisce la nuova struttura dell'API
      if (result.success && result.data) {
        return result.data;
      }
      
      // Fallback per struttura vuota - IMPORTANTE: restituisce sempre dati validi
      return { candidati: {}, idMap: {} };
    },
    enabled: !!user,
  });
};
