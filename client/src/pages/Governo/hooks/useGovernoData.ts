import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { VotiData } from "../types";

export const useGovernoData = (user: any) => {
  // Query per caricare i dati
  const { data, isLoading, isError } = useQuery<VotiData>({
    queryKey: ['governoVoti'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/governo/voti");
      if (!response.ok) throw new Error("Errore nel caricamento dei dati del governo.");
      return response.json();
    },
    enabled: !!user
  });

  return {
    data,
    isLoading,
    isError
  };
};
