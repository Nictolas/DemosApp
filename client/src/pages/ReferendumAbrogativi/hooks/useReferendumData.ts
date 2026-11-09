import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { Referendum } from "../types";

// Official ministry referendum collections only. Priority voting and
// user-submitted referendum proposals have been retired.
export const useReferendumData = (user: unknown) => {
  const { data, isLoading, isError } = useQuery<Referendum[]>({
    queryKey: ['referendumAbrogativi'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/referendum-abrogativi");
      if (!response?.ok || !response?.data?.success ||
          !Array.isArray(response.data.richieste)) {
        throw new Error("Errore nel caricamento dei referendum abrogativi");
      }
      return response.data.richieste as Referendum[];
    },
    enabled: Boolean(user),
    staleTime: 2 * 60 * 1000,
  });

  const referendumUfficiali = React.useMemo(() =>
    [...(data || [])].sort((a, b) => {
      const dateA = new Date(a.dataInizio || a.data_inizio || 0).getTime();
      const dateB = new Date(b.dataInizio || b.data_inizio || 0).getTime();
      return (Number.isFinite(dateB) ? dateB : 0) -
             (Number.isFinite(dateA) ? dateA : 0);
    }), [data]);

  return { referendumUfficiali, isLoading, isError };
};
