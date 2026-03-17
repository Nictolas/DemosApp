import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Ministero } from "../types";
import { API_ENDPOINTS, QUERY_KEYS, TOAST_MESSAGES } from "../constants";

export function useMinisteriData() {
  return useQuery<Ministero[]>({
    queryKey: QUERY_KEYS.MINISTERI,
    queryFn: async () => {
      const response = await apiRequest("GET", API_ENDPOINTS.MINISTERI);
      if (!response.ok) {
        throw new Error(TOAST_MESSAGES.ERROR.LOAD);
      }
      return response.json();
    },
  });
}
