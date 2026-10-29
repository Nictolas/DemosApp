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
        console.log('🔄 Dispatching force-rerender event');
        window.dispatchEvent(new Event('force-rerender'));
        
        // Forza anche un aggiornamento della location per wouter
        const currentPath = window.location.pathname;
        console.log('📍 Current path after navigation:', currentPath);
        
        // Piccolo delay per assicurarsi che wouter abbia aggiornato la location
        setTimeout(() => {
          window.dispatchEvent(new Event('force-rerender'));
        }, 50);
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
      // Solo per Backspace e solo se non siamo in un input/textarea
      if (event.key === 'Backspace') {
        // Preveni navigazione multipla
        if (isNavigating.current) {
          console.log('⚠️ Navigation already in progress, skipping keydown');
          return;
        }
        
        const target = event.target as HTMLElement;
        const isInputField = target && (
          target.tagName === 'INPUT' || 
          target.tagName === 'TEXTAREA' || 
          target.contentEditable === 'true' ||
          target.isContentEditable
        );
        
        // Solo se non siamo in un campo di input
        if (!isInputField) {
          // Preveni il comportamento predefinito del browser
          event.preventDefault();
          
          // Imposta flag di navigazione
          isNavigating.current = true;
          
          // Naviga alla pagina precedente logica
          const currentPath = window.location.pathname;
          const previousPath = getPreviousPath(currentPath);
          
          if (previousPath) {
            setLocation(previousPath);
          } else {
            // Fallback: vai al menu o alla home
            setLocation('/preferiti');
          }
          
          // Reset del flag dopo un delay
          setTimeout(() => {
            isNavigating.current = false;
          }, 1000);
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
      '/menu': '/preferiti',
      '/profilo': '/preferiti',
      '/opinioni': '/preferiti',
      '/rappresentanti': '/preferiti',
      '/governo': '/preferiti',
      '/elezioni': '/preferiti',
      '/ice': '/preferiti',
      '/iniziative-popolari': '/preferiti',
      '/referendum-abrogativi': '/preferiti',
      '/grazia': '/preferiti',
      '/amnistia': '/preferiti',
      '/capo-stato': '/preferiti',
      '/sondaggi': '/preferiti',
      '/comunicazioni': '/preferiti',
      '/eventi': '/preferiti',
      '/notifiche': '/preferiti',
      '/auth': '/',
      '/registrazione-nome': '/auth',
      '/registrazione-genere': '/auth',
      '/registrazione-cittadinanza': '/registrazione-genere',
      '/registrazione-2-dati': '/registrazione-cittadinanza',
      '/registrazione-3-residenza': '/registrazione-2-dati',
      '/registrazione-3-opinioni': '/registrazione-2-dati',
      '/registrazione-4-avatar': '/registrazione-3-opinioni',
      '/registrazione-5-conferma': '/registrazione-4-avatar'
    };
    const prev = pathMap[currentPath];
    if (currentPath === '/registrazione-genere' && typeof window !== 'undefined' && window.localStorage.getItem('webauthn_user_id'))
      return '/auth';
    return prev ?? null;
  };

  return {
    isNavigating: isNavigating.current
  };
}
