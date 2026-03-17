import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ReferendumAbrogativiData } from "../types";
import { useMemo } from "react";

export const useReferendumData = (user: any) => {
  const query = useQuery<ReferendumAbrogativiData>({
    queryKey: ['referendumAbrogativiData'],
    queryFn: async () => {
      try {
        console.log('🔍 DEBUG useReferendumData - Inizio fetch');
        const response = await apiRequest("GET", "/api/referendum-abrogativi?vota=true");
        console.log('🔍 DEBUG useReferendumData - Response completa:', JSON.stringify(response, null, 2));
        console.log('🔍 DEBUG useReferendumData - response.ok:', response?.ok);
        console.log('🔍 DEBUG useReferendumData - response.status:', response?.status);
        console.log('🔍 DEBUG useReferendumData - response.data:', response?.data);
        console.log('🔍 DEBUG useReferendumData - response.data type:', typeof response?.data);
        console.log('🔍 DEBUG useReferendumData - response.data keys:', response?.data ? Object.keys(response.data) : 'N/A');
        
        if (!response?.ok || !response?.data) {
          const errorMsg = response?.data?.error || response?.data?.message || "Errore nel caricamento dei referendum abrogativi";
          console.error('❌ DEBUG useReferendumData - Errore response (non ok o dati mancanti):', errorMsg);
          throw new Error(errorMsg);
        }
        
        const result = response.data;
        console.log('🔍 DEBUG useReferendumData - result completo:', JSON.stringify(result, null, 2));
        console.log('🔍 DEBUG useReferendumData - result.success:', result?.success);
        console.log('🔍 DEBUG useReferendumData - result.referendum:', result?.referendum);
        console.log('🔍 DEBUG useReferendumData - result.referendum type:', typeof result?.referendum);
        console.log('🔍 DEBUG useReferendumData - result.referendum isArray:', Array.isArray(result?.referendum));
        console.log('🔍 DEBUG useReferendumData - result.referendum length:', result?.referendum?.length);
        console.log('🔍 DEBUG useReferendumData - result.richieste:', result?.richieste);
        console.log('🔍 DEBUG useReferendumData - result.classifica:', result?.classifica);
        
        // Se result ha direttamente referendum senza success, gestiscilo
        if (result && (Array.isArray(result.referendum) || Array.isArray(result.richieste))) {
          console.log('✅ DEBUG useReferendumData - Trovato result.referendum o result.richieste come array');
          // Se non c'è success, aggiungilo
          if (result.success === undefined) {
            console.log('⚠️ DEBUG useReferendumData - result.success è undefined, aggiungendo success: true');
            return { ...result, success: true };
          }
        }
        
        if (!result || result.success === false) {
          const errorMsg = result?.error || result?.message || "Errore nel caricamento dei referendum abrogativi";
          console.error('❌ DEBUG useReferendumData - Errore result (success false o result null):', errorMsg);
          throw new Error(errorMsg);
        }
        
        console.log('✅ DEBUG useReferendumData - Restituendo result:', result);
        return result;
      } catch (err: any) {
        console.error('❌ DEBUG useReferendumData - Errore catturato:', err);
        console.error('❌ DEBUG useReferendumData - Errore message:', err?.message);
        console.error('❌ DEBUG useReferendumData - Errore stack:', err?.stack);
        throw err;
      }
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Il filtro per quorum_raggiunto = TRUE viene applicato lato API tramite il parametro ?vota=true
  return query;
};
