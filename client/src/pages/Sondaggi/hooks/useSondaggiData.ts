import { useAuth } from "@/hooks/use-auth-neon";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { SondaggiData, GenereData, SondaggiState } from "../types";

export const useSondaggiData = (): SondaggiState & {
  sondaggiData: SondaggiData | undefined;
  genereData: GenereData | undefined;
  isLoading: boolean;
  isError: boolean;
} => {
  const { user, isLoading: isAuthLoading } = useAuth();

  const { data: sondaggiData, isLoading: isSondaggiLoading, isError: isSondaggiError } = useQuery<SondaggiData>({
    queryKey: ['sondaggiStats'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/sondaggi");
      if (!response.ok) throw new Error("Errore nel caricamento delle statistiche.");
      const result = await response.json();
      return result.data;
    },
    enabled: !!user,
  });

  const { data: genereData } = useQuery<GenereData>({
    queryKey: ['sondaggiGenere'],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/sondaggi/genere");
      if (!response.ok) throw new Error("Errore nel caricamento statistiche genere.");
      const result = await response.json();
      return result.stats; // Cambiato da result.data a result.stats per coerenza con l'API
    },
    enabled: !!user,
  });

  // Controllo più flessibile per l'accesso ai sondaggi
  const userRole = user?.role || user?.ruolo;
  const hasAdvancedAccess = userRole === "Politico" || userRole === "Candidato" || userRole === "Candidato Politico" || userRole === "Admin";

  return {
    user,
    isLoading: isAuthLoading || isSondaggiLoading,
    isError: isSondaggiError,
    hasAdvancedAccess,
    sondaggiData,
    genereData
  };
};
