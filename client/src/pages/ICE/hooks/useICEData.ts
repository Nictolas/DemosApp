import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ICE, ICEData } from "../types";
import { QUERY_KEYS, API_ENDPOINTS, MESSAGES } from "../constants";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useICEData = (user: any) => {
  const { data: iceData, isLoading, isError } = useQuery<ICEData>({
    queryKey: QUERY_KEYS.ICE_LIST,
    queryFn: async () => {
      const result = await apiRequest("GET", API_ENDPOINTS.ICE_LIST);
      if (!result || !result.success) {
        throw new Error(result?.error || MESSAGES.ERROR.LOAD);
      }
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
