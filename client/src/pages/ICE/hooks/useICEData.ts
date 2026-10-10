import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ICE, ICEData } from "../types";

export const useICEData = (enabled: boolean) => {
  const { data, isLoading, isError, error, refetch } = useQuery<ICEData>({
    queryKey: ["/api/ice", "official-collection"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/ice");
      if (!response?.ok || !response?.data?.success) {
        throw new Error(
          response?.data?.error ||
            response?.data?.message ||
            "Errore nel caricamento delle ICE ufficiali",
        );
      }
      return response.data as ICEData;
    },
    enabled,
    retry: 1,
  });

  const listaICE: ICE[] = (data?.richieste || []).map((item: any) => ({
    ...item,
    nome: item.nome || item.title || "Senza titolo",
    descrizione: item.descrizione ?? item.obiettivi ?? null,
    firme: Number(item.firme ?? item.signature_count ?? 0) || 0,
    dataFine:
      item.dataFine ?? item.datafine ?? item.end_date ?? item.data_fine ?? null,
    sitoWeb: item.sitoWeb ?? item.sitoweb ?? item.url ?? null,
  }));

  return {
    listaICE,
    source: data?.source || null,
    ordering: data?.ordering || null,
    isLoading,
    isError,
    error,
    refetch,
  };
};
