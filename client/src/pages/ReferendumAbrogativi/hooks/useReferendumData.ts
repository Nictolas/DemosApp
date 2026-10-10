import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Referendum } from "../types";

export const useReferendumData = (user: any) => {
  const { data, isLoading, isError } = useQuery<{
    success: boolean;
    richieste: Referendum[];
    referendum?: Referendum[];
  }>({
    queryKey: ['referendumAbrogativi'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/referendum-abrogativi");
      if (!response?.ok || !response?.data?.success) {
        const errorMsg = response?.data?.error || response?.data?.message || "Errore nel caricamento dei referendum abrogativi";
        throw new Error(errorMsg);
      }
      return response.data;
    },
    enabled: !!user,
  });

  const listaReferendum = React.useMemo(() => {
    const referendum = [...(data?.richieste || [])];
    return referendum.sort((a, b) => {
      const dateA = new Date(a.dataInizio || a.data_inizio || 0);
      const dateB = new Date(b.dataInizio || b.data_inizio || 0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [data?.richieste]);

  // Dopo il ritiro delle proposte manuali e della priorità DEMOS, la pagina espone solo la raccolta ufficiale.
  return {
    listaReferendum,
    referendumUfficiali: listaReferendum,
    isLoading,
    isError,
  };
};
