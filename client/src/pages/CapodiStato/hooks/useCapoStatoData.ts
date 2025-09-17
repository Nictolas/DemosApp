import { useQuery } from "@tanstack/react-query";
import apiRequest from "@/lib/api-request";
import { CapoStatoData } from "../types";

export const useCapoStatoData = (user: any) => {
  return useQuery<CapoStatoData>({
    queryKey: ['capoStatoData'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/capo-stato");
      if (!response.ok) throw new Error("Errore nel caricamento dei dati.");
      return response.json();
    },
    enabled: !!user
  });
};
