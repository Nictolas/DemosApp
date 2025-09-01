import { useAuth } from "@/hooks/use-auth-neon";

export const useAccessControl = () => {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Controllo più flessibile per l'accesso alle statistiche
  const userRole = user?.role || user?.ruolo;
  const hasAdvancedAccess = userRole === "Politico" || userRole === "Candidato" || userRole === "Candidato Politico" || userRole === "Admin";

  return {
    user,
    isAuthLoading,
    hasAdvancedAccess,
  };
};
