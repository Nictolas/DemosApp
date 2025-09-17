import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { UltimaComunicazione } from "../types";

export const useComunicaData = () => {
  // Fetch ultima comunicazione
  const { data: ultimaComunicazione, isLoading: isLoadingUltima } = useQuery<UltimaComunicazione>({
    queryKey: ["ultimaComunicazione"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/comunicazioni/ultima");
      if (!response.ok) {
        throw new Error("Errore nel recupero dell'ultima comunicazione");
      }
      return response.json();
    },
    retry: 1,
  });

  return {
    ultimaComunicazione,
    isLoadingUltima,
  };
};
