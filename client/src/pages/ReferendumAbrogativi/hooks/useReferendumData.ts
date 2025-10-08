import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Referendum } from "../types";

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

  return {
    listaReferendum,
    mieiVoti: data?.mieiVoti || [],
    isLoading,
    isError,
  };
};