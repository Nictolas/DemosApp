import { useQuery } from "@tanstack/react-query";
import apiRequest from "@/lib/api-request";
import { RappresentantiData } from "../types";
import { useRoute } from "wouter";

export const useRappresentantiData = (user: any) => {
  const [isTestRoute] = useRoute("/test*");
  
  return useQuery<RappresentantiData>({
    queryKey: ['rappresentantiData', isTestRoute ? 'test' : 'rappresentanti'],
    queryFn: async () => {
      // Scegli l'endpoint corretto in base alla modalità
      const endpoint = isTestRoute ? `/api/elezioni/candidati` : `/api/rappresentanti`;
      console.log('🔍 DEBUG Frontend - Endpoint chiamato:', endpoint, 'isTestRoute:', isTestRoute);
      const response = await apiRequest("GET", endpoint);
      if (!response.ok) throw new Error("Errore nel caricamento dei dati");
      const result = await response.json();
      console.log('🔍 DEBUG Frontend - Risposta API:', result);
      
      // Gestisce la struttura dell'API in base alla modalità
      if (result.success && result.data) {
        if (isTestRoute) {
          // Per le route test, i dati sono direttamente in result.data
          console.log('🔍 DEBUG Frontend - Dati test ricevuti:', result.data);
          const finalData = {
            rappresentanti: result.data.candidati || {},
            idMap: result.data.idMap || {}
          };
          console.log('🔍 DEBUG Frontend - Dati finali per test:', finalData);
          return finalData;
        } else {
          // Per le route normali, i dati sono in { rappresentanti, idMap }
          console.log('🔍 DEBUG Frontend - Dati normali ricevuti:', result.data);
          return result.data;
        }
      }
      
      // Fallback per struttura vuota
      return { rappresentanti: {}, idMap: {} };
    },
    enabled: !!user,
  });
};
