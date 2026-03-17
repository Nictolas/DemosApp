import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { IniziativePopolariData } from "../types";

export const useIniziativeData = (user: any) => {
  return useQuery<IniziativePopolariData>({
    queryKey: ['iniziativePopolariData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/iniziative-popolari avviata');
      const response = await apiRequest("GET", "/api/iniziative-popolari?vota=true");
      console.log('✅ Dati iniziative popolari ricevuti:', response);
      if (!response?.ok || !response?.data) {
        const errorMsg = response?.data?.error || response?.data?.message || "Errore nel caricamento delle iniziative popolari";
        throw new Error(errorMsg);
      }
      const result = response.data;
      if (!result || !result.success) {
        throw new Error(result?.error || "Errore nel caricamento delle iniziative popolari");
      }
      return result;
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false,
    staleTime: 90 * 1000, // 90 secondi: evita refetch continui durante scroll
  });
};
