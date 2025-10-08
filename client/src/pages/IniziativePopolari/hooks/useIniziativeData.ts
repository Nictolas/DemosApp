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

  return {
    listaIniziative: data?.richieste || [],
    mieiVoti: data?.mieiVoti || [],
    isLoading,
    isError,
  };
};
