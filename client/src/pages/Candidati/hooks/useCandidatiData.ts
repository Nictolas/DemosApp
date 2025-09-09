import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ElezioniData } from "../types";

export const useCandidatiSelezionatiData = (user: any) => {
  return useQuery<ElezioniData>({
    queryKey: ['candidatiTuttiData'],
    queryFn: async () => {
      // Endpoint per tutti i candidati disponibili per tutte le categorie
      const response = await apiRequest("GET", `/api/candidati/tutti`);
      if (!response.ok) throw new Error("Errore nel caricamento dei candidati per le elezioni");
      const result = await response.json();
      
      // Gestisce la nuova struttura dell'API
      if (result.success && result.data) {
        return result.data;
      }
      
      // Fallback per struttura vuota - IMPORTANTE: restituisce sempre dati validi
      return { candidatiPerCategoria: {}, utente: {} };
    },
    enabled: !!user,
  });
};
