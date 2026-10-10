import { useAuth } from "@/hooks/use-auth";

export const useAccessControl = () => {
  const { user } = useAuth();

  const userRole = user?.ruolo;
  const isAdmin = Boolean(
    user?.capabilities?.isAdmin ?? user?.is_admin ?? (userRole === "AD"),
  );
  const isPolitician = Boolean(
    user?.capabilities?.isPolitician ??
      user?.is_politician ??
      (userRole === "P" || userRole === "CP"),
  );
  const isCandidate = Boolean(
    user?.capabilities?.isCandidate ??
      user?.is_candidate ??
      (userRole === "C" || userRole === "CP"),
  );

  // Comunica Voti è per Politici in carica; un Candidato standalone non ha un voto istituzionale da comunicare.
  const hasAdvancedAccess = isPolitician || isAdmin;
  const canAccessProgramma = isAdmin || isCandidate;

  return {
    user,
    userRole,
    hasAdvancedAccess,
    canAccessProgramma,
  };
};
