import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Referendum } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useReferendumData = (user: any) => {
  const { data, isLoading, isError } = useQuery<{
    richieste: Referendum[];
    mieiVoti: string[];
  }>({
    queryKey: ['referendumAbrogativi'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/referendum-abrogativi");
      if (!response.ok) throw new Error("Errore nel caricamento dei referendum abrogativi");
      const result = await response.json();
      return result;
    },
    enabled: !!user,
  });

  // Ordina i referendum per data di inizio (più recenti in alto)
  const listaReferendum = React.useMemo(() => {
    const referendum = data?.richieste || [];
    return referendum.sort((a, b) => {
      const dateA = new Date(a.dataInizio || a.datainizio || a.data_inizio || 0);
      const dateB = new Date(b.dataInizio || b.datainizio || b.data_inizio || 0);
      return dateB.getTime() - dateA.getTime(); // Più recenti in alto
    });
  }, [data?.richieste]);

  // Informazioni sui limiti di proposte
  const currentProposals = listaReferendum.filter(referendum => referendum.utente_id === user?.id).length;
  const limit = getVotingLimit('referendum_abrogativi_proposti');
  const remainingProposals = getRemainingVotes('referendum_abrogativi_proposti', currentProposals);
  const hasReachedLimit = hasReachedVotingLimit('referendum_abrogativi_proposti', currentProposals);

  return {
    listaReferendum,
    mieiVoti: data?.mieiVoti || [],
    isLoading,
    isError,
    // Informazioni sui limiti
    currentProposals,
    limit,
    remainingProposals,
    hasReachedLimit
  };
};