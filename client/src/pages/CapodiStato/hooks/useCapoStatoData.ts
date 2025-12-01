import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CapoStatoData } from "../types";

export const useCapoStatoData = (user: any) => {
  return useQuery<CapoStatoData>({
    queryKey: ['capoStatoData'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/capo-stato");
      if (!response?.ok || !response?.data) {
        throw new Error(response?.data?.error || "Errore nel caricamento dei dati.");
      }
      return response.data;
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });
};
