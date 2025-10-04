import { useAuth } from "@/hooks/use-auth-neon";
import { useNoScroll } from "@/hooks/useNoScroll";
import { MenuData } from "../types";

export const useMenuData = (): MenuData => {
  const { user, isLoading } = useAuth();
  
  // Blocca lo scroll della pagina
  useNoScroll(true);
  
  // Determina se l'utente è admin direttamente dai dati dell'utente
  const isAdmin = user?.role === 'Admin' || user?.ruolo === 'Admin';
  
  // Determina se l'utente ha accesso agli strumenti avanzati
  const userRole = user?.role || user?.ruolo;
  const hasAdvancedAccess = userRole === "Politico" || userRole === "Candidato" || userRole === "Candidato Politico" || userRole === "Admin" || userRole === "Attivista" || userRole === "Organizzazione";
  
  // Determina se l'utente ha accesso limitato (solo Evento e Sostenitori)
  const hasLimitedAccess = userRole === "Attivista" || userRole === "Organizzazione";

  return {
    user,
    isLoading,
    isAdmin,
    hasAdvancedAccess,
    hasLimitedAccess
  };
};
