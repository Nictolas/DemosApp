import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { IniziativePopolariData } from "../types";

export const useIniziativeData = (user: any) => {
  return useQuery<IniziativePopolariData>({
    queryKey: ['iniziativePopolariData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/iniziative-popolari avviata');
      const response = await apiRequest("GET", "/api/iniziative-popolari");
      console.log('🔍 DEBUG: Risposta ricevuta:', response.status);
      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ Errore API /iniziative-popolari:', errorData);
        throw new Error(`Errore ${response.status}: ${errorData}`);
      }
      const result = await response.json();
      console.log('✅ Dati iniziative popolari ricevuti:', result);
      return result;
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });
};
