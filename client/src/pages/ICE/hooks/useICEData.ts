import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ICE, ICEData } from "../types";
import { QUERY_KEYS, API_ENDPOINTS, MESSAGES } from "../constants";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useICEData = (user: any) => {
  const { data: iceData, isLoading, isError, error } = useQuery<ICEData>({
    queryKey: QUERY_KEYS.ICE_LIST,
    queryFn: async () => {
      try {
        console.log('🔍 DEBUG useICEData - Inizio fetch');
        const response = await apiRequest("GET", API_ENDPOINTS.ICE_LIST);
        console.log('🔍 DEBUG useICEData - Response completa:', JSON.stringify(response, null, 2));
        console.log('🔍 DEBUG useICEData - response.ok:', response?.ok);
        console.log('🔍 DEBUG useICEData - response.status:', response?.status);
        console.log('🔍 DEBUG useICEData - response.data:', response?.data);
        console.log('🔍 DEBUG useICEData - response.data type:', typeof response?.data);
        console.log('🔍 DEBUG useICEData - response.data keys:', response?.data ? Object.keys(response.data) : 'N/A');
        
        if (!response?.ok || !response?.data) {
          const errorMsg = response?.data?.error || response?.data?.message || MESSAGES.ERROR.LOAD;
          console.error('❌ DEBUG useICEData - Errore response (non ok o dati mancanti):', errorMsg);
          throw new Error(errorMsg);
        }
        
        const result = response.data;
        console.log('🔍 DEBUG useICEData - result completo:', JSON.stringify(result, null, 2));
        console.log('🔍 DEBUG useICEData - result.success:', result?.success);
        console.log('🔍 DEBUG useICEData - result.richieste:', result?.richieste);
        console.log('🔍 DEBUG useICEData - result.richieste type:', typeof result?.richieste);
        console.log('🔍 DEBUG useICEData - result.richieste isArray:', Array.isArray(result?.richieste));
        console.log('🔍 DEBUG useICEData - result.richieste length:', result?.richieste?.length);
        
        // Se result ha direttamente richieste senza success, gestiscilo
        if (result && Array.isArray(result.richieste)) {
          console.log('✅ DEBUG useICEData - Trovato result.richieste come array');
          // Se non c'è success, aggiungilo
          if (result.success === undefined) {
            console.log('⚠️ DEBUG useICEData - result.success è undefined, aggiungendo success: true');
            return { ...result, success: true };
          }
        }
        
        if (!result || result.success === false) {
          const errorMsg = result?.error || result?.message || MESSAGES.ERROR.LOAD;
          console.error('❌ DEBUG useICEData - Errore result (success false o result null):', errorMsg);
          throw new Error(errorMsg);
        }
        
        console.log('✅ DEBUG useICEData - Restituendo result:', result);
        return result;
      } catch (err: any) {
        console.error('❌ DEBUG useICEData - Errore catturato:', err);
        console.error('❌ DEBUG useICEData - Errore message:', err?.message);
        console.error('❌ DEBUG useICEData - Errore stack:', err?.stack);
        throw err;
      }
    },
    enabled: !!user,
    retry: 1,
  });
  
  // Log dello stato della query
  console.log('🔍 DEBUG useICEData - Stato query:', {
    isLoading,
    isError,
    error: error?.message,
    hasData: !!iceData,
    dataKeys: iceData ? Object.keys(iceData) : [],
    richiesteLength: iceData?.richieste?.length
  });

  const listaICE: ICE[] = (iceData?.richieste || []).map((item: any) => ({
    // normalizzazione chiavi dal backend (es. datainizio -> dataInizio)
    ...item,
    dataInizio: item.dataInizio ?? item.datainizio ?? item.data_inizio ?? item.data_inizio_raccolta ?? item.dataInizioRaccolta ?? null,
    dataFine: item.dataFine ?? item.datafine ?? item.data_fine ?? item.data_fine_raccolta ?? item.dataFineRaccolta ?? null,
    sitoWeb: item.sitoWeb ?? item.sitoweb ?? item.sito_web ?? null,
  }));
  const mieiVoti = iceData?.mieiVoti || [];

  // Informazioni sui limiti di proposte
  const currentProposals = listaICE.filter(ice => ice.utente_id === user?.id).length;
  const limit = getVotingLimit('ice_proposti');
  const remainingProposals = getRemainingVotes('ice_proposti', currentProposals);
  const hasReachedLimit = hasReachedVotingLimit('ice_proposti', currentProposals);

  return {
    listaICE,
    mieiVoti,
    isLoading,
    isError,
    // Informazioni sui limiti
    currentProposals,
    limit,
    remainingProposals,
    hasReachedLimit
  };
};
