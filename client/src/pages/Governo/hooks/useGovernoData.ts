import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { VotiData } from "../types";

export const useGovernoData = (user: any) => {
  // Query per caricare i dati
  const { data, isLoading, isError } = useQuery<VotiData>({
    queryKey: ['governoVoti', user?.id],
    queryFn: async ({ signal }) => {
      const response = await apiRequest("GET", "/api/governo/voti", undefined, undefined, signal);
      if (!response.ok) throw new Error("Errore nel caricamento dei dati del governo.");
      return response.json();
    },
    enabled: !!user?.id
  });

  return {
    data,
    isLoading,
    isError
  };
};
