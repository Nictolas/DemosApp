import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ICE, ICEData } from "../types";
import { QUERY_KEYS, API_ENDPOINTS, MESSAGES } from "../constants";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useICEData = (user: any) => {
  const { data: iceData, isLoading, isError } = useQuery<ICEData>({
    queryKey: QUERY_KEYS.ICE_LIST,
    queryFn: async () => {
      console.log('🔍 DEBUG useICEData - Inizio fetch');
      const response = await apiRequest("GET", API_ENDPOINTS.ICE_LIST);
      console.log('🔍 DEBUG useICEData - Response:', response);
      console.log('🔍 DEBUG useICEData - response.ok:', response?.ok);
      console.log('🔍 DEBUG useICEData - response.data:', response?.data);
      
      if (!response?.ok || !response?.data) {
        const errorMsg = response?.data?.error || response?.data?.message || MESSAGES.ERROR.LOAD;
        console.error('🔍 DEBUG useICEData - Errore response:', errorMsg);
        throw new Error(errorMsg);
      }
      const result = response.data;
      console.log('🔍 DEBUG useICEData - result:', result);
      console.log('🔍 DEBUG useICEData - result.success:', result?.success);
      console.log('🔍 DEBUG useICEData - result.richieste:', result?.richieste);
      console.log('🔍 DEBUG useICEData - result.richieste length:', result?.richieste?.length);
      
      if (!result || !result.success) {
        const errorMsg = result?.error || MESSAGES.ERROR.LOAD;
        console.error('🔍 DEBUG useICEData - Errore result:', errorMsg);
        throw new Error(errorMsg);
      }
      console.log('🔍 DEBUG useICEData - Restituendo result:', result);
      return result;
    },
    enabled: !!user,
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
