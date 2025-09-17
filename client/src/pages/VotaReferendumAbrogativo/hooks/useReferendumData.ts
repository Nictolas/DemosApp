import { useQuery } from "@tanstack/react-query";
import apiRequest from "@/lib/api-request";
import { ReferendumAbrogativiData } from "../types";

export const useReferendumData = (user: any) => {
  return useQuery<ReferendumAbrogativiData>({
    queryKey: ['referendumAbrogativiData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/referendum-abrogativi avviata');
      const response = await apiRequest("GET", "/api/referendum-abrogativi");
      console.log('🔍 DEBUG: Risposta ricevuta:', response.status);
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Errore API /referendum-abrogativi:', errorData);
        throw new Error(`Errore ${response.status}: ${errorData}`);
      }
      const result = await response.json();
      console.log('✅ Dati referendum abrogativi ricevuti:', result);
      return result;
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });
};
