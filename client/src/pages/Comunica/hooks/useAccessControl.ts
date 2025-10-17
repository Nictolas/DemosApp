import { useAuth } from "@/hooks/use-auth-neon";

export const useAccessControl = () => {
  const { user } = useAuth();

  // Check if user has the right role for advanced features
  const userRole = user?.ruolo;
  const hasAdvancedAccess = userRole === "P" || userRole === "C" || userRole === "CP" || userRole === "AD";

  // Check specific role access
  const canAccessProgramma = user?.ruolo === "AD" || user?.ruolo === "C" || user?.ruolo === "CP";

  return {
    user,
    userRole,
    hasAdvancedAccess,
    canAccessProgramma,
  };
};
