import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { EtaDataItem } from "../types";

export const useEtaStats = (opinionId: string) => {
  return useQuery<EtaDataItem[]>({
    queryKey: ['opinioneEtaStats', opinionId, window.location.pathname],
    queryFn: async () => {
      // Controlla se siamo in una pagina regionale
      const pathParts = window.location.pathname.split('/');
      let endpoint = `/api/opinioni/stats/${opinionId}/eta`;
      
      // Se l'URL contiene "regione", usa l'endpoint filtrato
      if (pathParts.includes('regione') && pathParts.length > 3) {
        const regioneIndex = pathParts.indexOf('regione');
        const regione = pathParts[regioneIndex + 1];
        endpoint = `/api/opinioni/stats/${opinionId}/eta/regione/${regione}`;
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint età regionale:', endpoint);
      } else {
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint età nazionale:', endpoint);
      }
      
      const response = await apiRequest("GET", endpoint, null, {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      if (!response.ok) throw new Error("Errore nel caricamento statistiche età.");
      const result = await response.json();
      console.log('🔍 DEBUG StatisticheOpinione - Dati età ricevuti:', result.data);
      return result.data;
    },
    enabled: !!opinionId,
    staleTime: 0,
    gcTime: 0,
  });
};
