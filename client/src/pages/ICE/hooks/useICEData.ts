import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ICEData } from "../types";
import { QUERY_KEYS, API_ENDPOINTS, MESSAGES } from "../constants";

export const useICEData = (user: any) => {
  const { data: iceData, isLoading, isError } = useQuery<ICEData>({
    queryKey: QUERY_KEYS.ICE_LIST,
    queryFn: async () => {
      const response = await apiRequest("GET", API_ENDPOINTS.ICE_LIST);
      if (!response.ok) throw new Error(MESSAGES.ERROR.LOAD);
      return response.json();
    },
    enabled: !!user,
  });

  const listaICE = iceData?.richieste || [];
  const mieiVoti = iceData?.mieiVoti || [];

  return {
    listaICE,
    mieiVoti,
    isLoading,
    isError
  };
};
