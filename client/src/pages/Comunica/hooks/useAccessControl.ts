import { useAuth } from "@/hooks/use-auth-neon";

export const useAccessControl = () => {
  const { user } = useAuth();

  // Check if user has the right role for advanced features
  const userRole = user?.ruolo || user?.role;
  const hasAdvancedAccess = userRole === "Politico" || userRole === "Candidato" || userRole === "Candidato Politico" || userRole === "Admin";

  // Check specific role access
  const canAccessProgramma = user?.ruolo === 'Admin' || user?.ruolo === 'Candidato' || user?.ruolo === 'Candidato Politico';

  return {
    user,
    userRole,
    hasAdvancedAccess,
    canAccessProgramma,
  };
};
