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
      console.log('🔍 DEBUG useReferendumData - Inizio fetch');
      const response = await apiRequest("GET", "/api/referendum-abrogativi");
      console.log('🔍 DEBUG useReferendumData - Response:', response);
      console.log('🔍 DEBUG useReferendumData - response.ok:', response?.ok);
      console.log('🔍 DEBUG useReferendumData - response.data:', response?.data);
      
      if (!response?.ok || !response?.data) {
        const errorMsg = response?.data?.error || response?.data?.message || "Errore nel caricamento dei referendum abrogativi";
        console.error('🔍 DEBUG useReferendumData - Errore response:', errorMsg);
        throw new Error(errorMsg);
      }
      const result = response.data;
      console.log('🔍 DEBUG useReferendumData - result:', result);
      console.log('🔍 DEBUG useReferendumData - result.success:', result?.success);
      console.log('🔍 DEBUG useReferendumData - result.richieste:', result?.richieste);
      console.log('🔍 DEBUG useReferendumData - result.richieste length:', result?.richieste?.length);
      
      if (!result || !result.success) {
        const errorMsg = result?.error || "Errore nel caricamento dei referendum abrogativi";
        console.error('🔍 DEBUG useReferendumData - Errore result:', errorMsg);
        throw new Error(errorMsg);
      }
      console.log('🔍 DEBUG useReferendumData - Restituendo result:', result);
      return result;
    },
    enabled: !!user,
  });

  // Ordina i referendum per data di inizio (più recenti in alto)
  const listaReferendum = React.useMemo(() => {
    const referendum = data?.richieste || [];
    return referendum.sort((a, b) => {
      const dateA = new Date(a.dataInizio || a.data_inizio || 0);
      const dateB = new Date(b.dataInizio || b.data_inizio || 0);
      return dateB.getTime() - dateA.getTime(); // Più recenti in alto
    });
  }, [data?.richieste]);

  // Separa i referendum proposti da quelli ufficiali
  const referendumUfficiali = React.useMemo(() => {
    return listaReferendum.filter(referendum => referendum.quorum !== 'proposta');
  }, [listaReferendum]);

  const referendumProposte = React.useMemo(() => {
    return listaReferendum.filter(referendum => referendum.quorum === 'proposta');
  }, [listaReferendum]);

  // Filtra le proposte dell'utente corrente (sia userid che utente_id per compatibilità)
  const mioReferendumProposto = React.useMemo(() => {
    if (!user?.id) return null;
    return referendumProposte.find(
      referendum => 
        (referendum.userid === user.id || referendum.utente_id === user.id) &&
        referendum.quorum === 'proposta'
    ) || null;
  }, [referendumProposte, user?.id]);

  // Informazioni sui limiti di proposte - usa userid o utente_id
  const currentProposals = referendumProposte.filter(referendum => referendum.userid === user?.id || referendum.utente_id === user?.id).length;
  const limit = getVotingLimit('referendum_abrogativi_proposti');
  const remainingProposals = getRemainingVotes('referendum_abrogativi_proposti', currentProposals);
  const hasReachedLimit = hasReachedVotingLimit('referendum_abrogativi_proposti', currentProposals);

  return {
    listaReferendum,
    referendumUfficiali,
    referendumProposte,
    mioReferendumProposto,
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