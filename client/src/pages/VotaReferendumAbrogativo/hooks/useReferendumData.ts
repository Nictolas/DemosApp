import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { ReferendumAbrogativiData } from "../types";
import { useMemo } from "react";

export const useReferendumData = (user: any) => {
  const query = useQuery<ReferendumAbrogativiData>({
    queryKey: ['referendumAbrogativiData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/referendum-abrogativi avviata');
      const result = await apiRequest("GET", "/api/referendum-abrogativi");
      console.log('✅ Dati referendum abrogativi ricevuti:', result);
      return result;
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });

  // Filtra i referendum per mostrare solo quelli con esito = 'In Attesa'
  const filteredData = useMemo(() => {
    if (!query.data) return query.data;
    
    const filteredReferendum = (query.data.referendum || []).filter(
      (ref: any) => ref.esito === 'In Attesa'
    );
    
    // Filtra anche la classifica per includere solo i referendum con esito = 'In Attesa'
    const filteredClassifica = (query.data.classifica || []).filter((item: any) => {
      return filteredReferendum.some((ref: any) => ref.nome === item.nome);
    });
    
    return {
      ...query.data,
      referendum: filteredReferendum,
      classifica: filteredClassifica
    };
  }, [query.data]);

  return {
    ...query,
    data: filteredData
  };
};
