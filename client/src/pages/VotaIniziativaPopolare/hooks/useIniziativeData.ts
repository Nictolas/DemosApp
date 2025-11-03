import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { IniziativePopolariData } from "../types";

export const useIniziativeData = (user: any) => {
  return useQuery<IniziativePopolariData>({
    queryKey: ['iniziativePopolariData'],
    queryFn: async () => {
      console.log('🔍 DEBUG: Chiamata /api/iniziative-popolari avviata');
      const result = await apiRequest("GET", "/api/iniziative-popolari");
      console.log('✅ Dati iniziative popolari ricevuti:', result);
      return result;
    },
    enabled: !!user && !!localStorage.getItem('auth_token'),
    retry: 1,
    refetchOnWindowFocus: false
  });
};
