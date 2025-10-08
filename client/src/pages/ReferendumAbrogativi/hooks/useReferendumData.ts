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

  return {
    listaReferendum: data?.richieste || [],
    mieiVoti: data?.mieiVoti || [],
    isLoading,
    isError,
  };
};