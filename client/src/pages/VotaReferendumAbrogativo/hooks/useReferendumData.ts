import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ReferendumAbrogativiData } from "../types";
import { useMemo } from "react";

export const useReferendumData = (user: any) => {
  const query = useQuery<ReferendumAbrogativiData>({
    queryKey: ['referendumAbrogativiData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/referendum-abrogativi avviata');
      const response = await apiRequest("GET", "/api/referendum-abrogativi?vota=true");
      console.log('✅ Dati referendum abrogativi ricevuti:', response);
      if (!response?.ok || !response?.data) {
        const errorMsg = response?.data?.error || response?.data?.message || "Errore nel caricamento dei referendum abrogativi";
        throw new Error(errorMsg);
      }
      const result = response.data;
      if (!result || !result.success) {
        throw new Error(result?.error || "Errore nel caricamento dei referendum abrogativi");
      }
      return result;
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Il filtro per quorum_raggiunto = TRUE viene applicato lato API tramite il parametro ?vota=true
  return query;
};
