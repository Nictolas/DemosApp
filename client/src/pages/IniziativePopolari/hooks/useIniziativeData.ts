import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { IniziativaPopolare } from "../types";
import { getVotingLimit, hasReachedVotingLimit, getRemainingVotes } from "@/config/votingLimits";

export const useIniziativeData = (user: any) => {
  const { data, isLoading, isError } = useQuery<{
    richieste: IniziativaPopolare[];
    mieiVoti: string[];
  }>({
    queryKey: ['iniziativePopolari'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/iniziative-popolari");
      if (!response?.ok || !response?.data) {
        const errorMsg = response?.data?.error || response?.data?.message || "Errore nel caricamento delle iniziative popolari";
        throw new Error(errorMsg);
      }
      const result = response.data;
      if (!result || !result.success) {
        throw new Error(result?.error || "Errore nel caricamento delle iniziative popolari");
      }
      return result;
    },
    enabled: !!user,
  });

  // Ordina le iniziative per data di inizio (più recenti in alto)
  const listaIniziative = React.useMemo(() => {
    const iniziative = data?.richieste || [];
    return iniziative.sort((a, b) => {
      const dateA = new Date(a.dataInizio || a.data_inizio || 0);
      const dateB = new Date(b.dataInizio || b.data_inizio || 0);
      return dateB.getTime() - dateA.getTime(); // Più recenti in alto
    });
  }, [data?.richieste]);

  // Separa le iniziative proposte da quelle ufficiali
  const iniziativeUfficiali = React.useMemo(() => {
    return listaIniziative.filter(iniziativa => iniziativa.quorum !== 'proposta');
  }, [listaIniziative]);

  const iniziativeProposte = React.useMemo(() => {
    return listaIniziative.filter(iniziativa => iniziativa.quorum === 'proposta');
  }, [listaIniziative]);

  // Filtra le proposte dell'utente corrente (sia userid che utente_id per compatibilità)
  const miaIniziativaProposta = React.useMemo(() => {
    if (!user?.id) return null;
    return iniziativeProposte.find(
      iniziativa => 
        (iniziativa.userid === user.id || iniziativa.utente_id === user.id) &&
        iniziativa.quorum === 'proposta'
    ) || null;
  }, [iniziativeProposte, user?.id]);

  // Informazioni sui limiti di proposte - usa userid o utente_id
  const currentProposals = listaIniziative.filter(
    iniziativa => iniziativa.userid === user?.id || iniziativa.utente_id === user?.id
  ).length;
  const limit = getVotingLimit('iniziative_popolari_proposte');
  const remainingProposals = getRemainingVotes('iniziative_popolari_proposte', currentProposals);
  const hasReachedLimit = hasReachedVotingLimit('iniziative_popolari_proposte', currentProposals);

  return {
    listaIniziative,
    iniziativeUfficiali,
    iniziativeProposte,
    miaIniziativaProposta,
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
