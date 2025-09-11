import { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from './use-auth-neon';

export const useMenuState = () => {
  const [isMenuReady, setIsMenuReady] = useState(false);
  const [location] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    // Reset state when location changes
    setIsMenuReady(false);

    // Only check if we are on the /menu path
    if (location === '/menu') {
      console.log('🔍 useMenuState - Inizio controllo stato Menu per /menu');
      console.log('🔍 useMenuState - Stato auth:', { user: !!user, isLoading });

      // Aspetta che l'auth sia completato E che l'utente sia disponibile
      if (!isLoading && user) {
        console.log('✅ useMenuState - Menu pronto: utente disponibile e auth completato');
        // Aggiungi un piccolo delay per assicurarsi che il componente sia renderizzato
        const timer = setTimeout(() => {
          setIsMenuReady(true);
        }, 500);
        
        return () => clearTimeout(timer);
      } else if (!isLoading && !user) {
        // Se l'auth è finito ma non c'è utente, il menu è comunque pronto (per utenti non autenticati)
        console.log('⚠️ useMenuState - Menu pronto: auth completato ma nessun utente');
        const timer = setTimeout(() => {
          setIsMenuReady(true);
        }, 500);
        
        return () => clearTimeout(timer);
      }
    } else {
      // If not on /menu, ensure it's false
      setIsMenuReady(false);
    }
  }, [location, user, isLoading]);

  return isMenuReady;
};
