import { useAuth } from "@/hooks/use-auth-neon";

export const useAccessControl = () => {
  const { user, isLoading: isAuthLoading } = useAuth();

  // Controllo più flessibile per l'accesso alle statistiche
  const userRole = user?.ruolo;
  const hasAdvancedAccess = userRole === "P" || userRole === "C" || userRole === "CP" || userRole === "AD";

  return {
    user,
    isAuthLoading,
    hasAdvancedAccess,
  };
};
