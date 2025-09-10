import { useEffect, useRef } from 'react';
import { useLocation } from 'wouter';

/**
 * Hook per gestire la navigazione del browser (pulsanti indietro/avanti)
 * Previene blocchi e conflitti con le transizioni delle pagine
 */
export function useBrowserNavigation() {
  const [, setLocation] = useLocation();
  const isNavigating = useRef(false);
  const navigationTimeout = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      console.log('🔄 Browser navigation detected:', event);
      
      // Preveni navigazione multipla
      if (isNavigating.current) {
        console.log('⚠️ Navigation already in progress, skipping');
        return;
      }

      isNavigating.current = true;

      // Pulisci timeout precedente
      if (navigationTimeout.current) {
        clearTimeout(navigationTimeout.current);
      }

      // Reset dello stato dopo un breve delay
      navigationTimeout.current = setTimeout(() => {
        isNavigating.current = false;
        console.log('✅ Navigation state reset');
      }, 500);

      // Forza un re-render per assicurarsi che le transizioni funzionino
      setTimeout(() => {
        window.dispatchEvent(new Event('force-rerender'));
      }, 100);
    };

    const handleBeforeUnload = () => {
      // Reset dello stato prima di lasciare la pagina
      isNavigating.current = false;
      if (navigationTimeout.current) {
        clearTimeout(navigationTimeout.current);
      }
    };

    // Gestione del tasto indietro della tastiera
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Backspace' && !event.target || 
          (event.target as HTMLElement).tagName === 'BODY') {
        // Preveni il comportamento predefinito del browser
        event.preventDefault();
        
        // Naviga alla pagina precedente logica
        const currentPath = window.location.pathname;
        const previousPath = getPreviousPath(currentPath);
        
        if (previousPath) {
          setLocation(previousPath);
        } else {
          // Fallback: vai al menu o alla home
          setLocation('/menu');
        }
      }
    };

    // Aggiungi event listeners
    window.addEventListener('popstate', handlePopState);
    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('popstate', handlePopState);
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('keydown', handleKeyDown);
      
      if (navigationTimeout.current) {
        clearTimeout(navigationTimeout.current);
      }
    };
  }, [setLocation]);

  // Funzione helper per determinare il percorso precedente
  const getPreviousPath = (currentPath: string): string | null => {
    const pathMap: { [key: string]: string } = {
      '/menu': '/',
      '/profilo': '/menu',
      '/opinioni': '/menu',
      '/rappresentanti': '/menu',
      '/governo': '/menu',
      '/elezioni': '/menu',
      '/ice': '/menu',
      '/iniziative-popolari': '/menu',
      '/referendum-abrogativi': '/menu',
      '/grazia': '/menu',
      '/amnistia': '/menu',
      '/capo-stato': '/menu',
      '/sondaggi': '/menu',
      '/comunicazioni': '/menu',
      '/eventi': '/menu',
      '/notifiche': '/menu',
      '/auth': '/',
      '/registrazione-nome': '/auth',
      '/registrazione-genere': '/registrazione-nome',
      '/registrazione-cittadinanza': '/registrazione-genere',
      '/registrazione-ruolo': '/registrazione-cittadinanza',
      '/registrazione-2-dati': '/registrazione-ruolo',
      '/registrazione-3-opinioni': '/registrazione-2-dati',
      '/registrazione-4-avatar': '/registrazione-3-opinioni',
      '/registrazione-5-conferma': '/registrazione-4-avatar'
    };
    
    return pathMap[currentPath] || null;
  };

  return {
    isNavigating: isNavigating.current
  };
}
