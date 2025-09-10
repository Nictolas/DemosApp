import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { RappresentantiData } from "../types";
import { useRoute } from "wouter";

export const useRappresentantiData = (user: any) => {
  const [isTestRoute] = useRoute("/test*");
  
  return useQuery<RappresentantiData>({
    queryKey: ['rappresentantiData', isTestRoute ? 'test' : 'rappresentanti'],
    queryFn: async () => {
      // Scegli l'endpoint corretto in base alla modalità
      const endpoint = isTestRoute ? `/api/elezioni/candidati` : `/api/rappresentanti`;
      const response = await apiRequest("GET", endpoint);
      if (!response.ok) throw new Error("Errore nel caricamento dei dati");
      const result = await response.json();
      
      // Gestisce la struttura dell'API in base alla modalità
      if (result.success && result.data) {
        if (isTestRoute) {
          // Per le route test, i dati sono in { candidati, idMap }
          console.log('🔍 DEBUG Frontend - Dati test ricevuti:', result.data);
          return {
            rappresentanti: result.data.candidati || {},
            idMap: result.data.idMap || {}
          };
        } else {
          // Per le route normali, i dati sono in { rappresentanti, idMap }
          return result.data;
        }
      }
      
      // Fallback per struttura vuota
      return { rappresentanti: {}, idMap: {} };
    },
    enabled: !!user,
  });
};
