import { useAuth } from "@/hooks/use-auth-neon";
import { useNoScroll } from "@/hooks/useNoScroll";
import { MenuData } from "../types";

export const useMenuData = (): MenuData => {
  const { user, isLoading } = useAuth();
  
  // Blocca lo scroll della pagina
  useNoScroll(true);
  
  // Determina se l'utente è admin direttamente dai dati dell'utente
  const isAdmin = user?.ruolo === "AD";
  
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
