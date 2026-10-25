import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CapoStatoData } from "../types";

export const useCapoStatoData = (user: any) => {
  return useQuery<CapoStatoData>({
    queryKey: ['capoStatoData', user?.id],
    queryFn: async ({ signal }) => {
      const response = await apiRequest("GET", "/api/capo-stato", undefined, undefined, signal);
      if (!response?.ok || !response?.data) {
        throw new Error(response?.data?.error || "Errore nel caricamento dei dati.");
      }
      return response.data;
    },
    enabled: !!user?.id && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });
};
