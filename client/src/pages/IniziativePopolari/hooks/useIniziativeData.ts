import React from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { IniziativaPopolare } from "../types";

export const useIniziativeData = (user: any) => {
  const { data, isLoading, isError } = useQuery<{
    richieste: IniziativaPopolare[];
    mieiVoti: string[];
  }>({
    queryKey: ['iniziativePopolari'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/iniziative-popolari");
      if (!response.ok) throw new Error("Errore nel caricamento delle iniziative popolari");
      const result = await response.json();
      return result;
    },
    enabled: !!user,
  });

  // Ordina le iniziative per data di inizio (più recenti in alto)
  const listaIniziative = React.useMemo(() => {
    const iniziative = data?.richieste || [];
    return iniziative.sort((a, b) => {
      const dateA = new Date(a.dataInizio || a.datainizio || a.data_inizio || 0);
      const dateB = new Date(b.dataInizio || b.datainizio || b.data_inizio || 0);
      return dateB.getTime() - dateA.getTime(); // Più recenti in alto
    });
  }, [data?.richieste]);

  return {
    listaIniziative,
    mieiVoti: data?.mieiVoti || [],
    isLoading,
    isError,
  };
};
