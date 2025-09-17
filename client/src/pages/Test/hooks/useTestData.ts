import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { apiRequest } from "@/lib/queryClient";

export const useTestData = () => {
  const { user, isLoading: authLoading } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [hasAdvancedAccess, setHasAdvancedAccess] = useState(false);

  useEffect(() => {
    const fetchUserData = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }

      try {
        // Controlla se l'utente è admin
        const adminStatus = user.ruolo === 'Admin' || user.ruolo === 'admin';
        setIsAdmin(adminStatus);
        
        // Controlla se l'utente ha accesso avanzato
        const advancedAccess = adminStatus || user.ruolo === 'Politico' || user.ruolo === 'Candidato';
        setHasAdvancedAccess(advancedAccess);

      } catch (error) {
        console.error("Errore durante il caricamento dei dati utente:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (!authLoading) {
      fetchUserData();
    }
  }, [user, authLoading]);

  return {
    user,
    isLoading: authLoading || isLoading,
    isAdmin,
    hasAdvancedAccess
  };
};
