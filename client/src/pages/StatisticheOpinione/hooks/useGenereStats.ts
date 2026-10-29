import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { SessoDataItem } from "../types";

export const useGenereStats = (opinionId: string) => {
  return useQuery<SessoDataItem[]>({
    queryKey: ['opinioneSessoStats', opinionId, window.location.pathname],
    queryFn: async () => {
      // Controlla se siamo in una pagina regionale
      const pathParts = window.location.pathname.split('/');
      let endpoint = `/api/opinioni/stats/${opinionId}/sesso`;
      
      // Se l'URL contiene "regione", usa l'endpoint filtrato
      if (pathParts.includes('regione') && pathParts.length > 3) {
        const regioneIndex = pathParts.indexOf('regione');
        const regione = pathParts[regioneIndex + 1];
        endpoint = `/api/opinioni/stats/${opinionId}/sesso/regione/${regione}`;
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint sesso regionale:', endpoint);
      } else {
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint sesso nazionale:', endpoint);
      }
      
      const response = await apiRequest("GET", endpoint, null, {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      if (!response.ok) throw new Error("Errore nel caricamento statistiche per sesso anagrafico.");
      const result = await response.json();
      console.log('🔍 DEBUG StatisticheOpinione - Dati sesso aggregati ricevuti:', result.data);
      return result.data;
    },
    enabled: !!opinionId,
    staleTime: 0,
    cacheTime: 0,
  });
};
