import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ReferendumAbrogativiData } from "../types";
import { useMemo } from "react";

export const useReferendumData = (user: any) => {
  const query = useQuery<ReferendumAbrogativiData>({
    queryKey: ['referendumAbrogativiData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/referendum-abrogativi avviata');
      const result = await apiRequest("GET", "/api/referendum-abrogativi?vota=true");
      console.log('✅ Dati referendum abrogativi ricevuti:', result);
      return result;
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Il filtro per quorum_raggiunto = TRUE viene applicato lato API tramite il parametro ?vota=true
  return query;
};
