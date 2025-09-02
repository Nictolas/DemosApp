import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Referendum } from "../types";
import { QUERY_KEYS, API_ENDPOINTS, MESSAGES } from "../constants";

export const useReferendumData = (user: any) => {
  // Query per caricare la lista dei referendum
  const { data: listaReferendum = [], isLoading, isError } = useQuery<Referendum[]>({
    queryKey: QUERY_KEYS.REFERENDUM_LIST,
    queryFn: async () => {
      const response = await apiRequest("GET", API_ENDPOINTS.REFERENDUM_LIST);
      if (!response.ok) throw new Error(MESSAGES.ERROR.LOAD);
      return response.json();
    },
    enabled: !!user,
  });

  return {
    listaReferendum,
    isLoading,
    isError
  };
};
