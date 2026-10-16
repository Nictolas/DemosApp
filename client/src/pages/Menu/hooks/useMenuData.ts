import { useAuth } from "@/hooks/use-auth";
import { useNoScroll } from "@/hooks/useNoScroll";
import { hasAdminCapability } from "@/lib/admin-access";
import { MenuData } from "../types";

export const useMenuData = (): MenuData => {
  const { user, isLoading } = useAuth();
  
  // Blocca lo scroll della pagina
  useNoScroll(true);
  
  // Admin è una capability canonica: non derivare privilegi dal ruolo legacy.
  const isAdmin = hasAdminCapability(user);
  
  // Determina se l'utente ha accesso agli strumenti avanzati
  const userRole = user?.ruolo;
  const hasAdvancedAccess = userRole === "P" || userRole === "C" || userRole === "CP" || userRole === "AD" || userRole === "A" || userRole === "O";
  
  // Determina se l'utente ha accesso limitato (solo Evento e Sostenitori)
  const hasLimitedAccess = userRole === "A" || userRole === "O";

  return {
    user,
    isLoading,
    isAdmin,
    hasAdvancedAccess,
    hasLimitedAccess
  };
};
