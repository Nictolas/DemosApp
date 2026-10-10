import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { OpinionData } from "../types";

export const useOpinionStats = (opinionId: string) => {
  console.log('🔍 DEBUG useOpinionStats - opinionId ricevuto:', opinionId);
  console.log('🔍 DEBUG useOpinionStats - opinionId valido:', !!opinionId);
  
  return useQuery<OpinionData>({
    queryKey: ['opinioneStats', opinionId, window.location.pathname],
    queryFn: async () => {
      console.log('🔍 DEBUG useOpinionStats - Inizio query per opinionId:', opinionId);
      
      // Controlla se siamo in una pagina regionale
      const pathParts = window.location.pathname.split('/');
      let endpoint = `/api/opinioni/stats/${opinionId}`;
      
      // Se l'URL contiene "regione", usa l'endpoint filtrato
      if (pathParts.includes('regione') && pathParts.length > 3) {
        const regioneIndex = pathParts.indexOf('regione');
        const regione = pathParts[regioneIndex + 1];
        endpoint = `/api/opinioni/stats/${opinionId}/regione/${regione}`;
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint stats regionale:', endpoint);
      } else {
        console.log('🔍 DEBUG StatisticheOpinione - Endpoint stats nazionale:', endpoint);
      }
      
      console.log('🔍 DEBUG useOpinionStats - Chiamata API in corso...');
      const response = await apiRequest("GET", endpoint, null, {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      });
      
      console.log('🔍 DEBUG useOpinionStats - Response status:', response.status);
      console.log('🔍 DEBUG useOpinionStats - Response ok:', response.ok);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('🔍 DEBUG useOpinionStats - Errore response:', errorText);
        throw new Error(`Errore nel caricamento statistiche: ${response.status} - ${errorText}`);
      }
      
      const result = await response.json();
      console.log('🔍 DEBUG StatisticheOpinione - Dati ricevuti:', result);
      console.log('🔍 DEBUG StatisticheOpinione - Data:', result.data);
      return result.data;
    },
    enabled: !!opinionId,
    staleTime: 0,
    gcTime: 0,
  });
};
