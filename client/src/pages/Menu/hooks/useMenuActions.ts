import { useLocation } from "wouter";

export const useMenuActions = () => {
  const [, setLocation] = useLocation();

  // Funzione per navigare con effetto "ripristino pulsante"
  const navigateWithButtonReset = (path: string, event: React.MouseEvent<HTMLButtonElement>) => {
    const button = event.currentTarget;
    
    // Aggiungi classe per effetto "premuto" (schiacciato)
    button.classList.add('scale-95', 'shadow-md');
    
    // Dopo 150ms, ripristina il pulsante allo stato originale
    setTimeout(() => {
      button.classList.remove('scale-95', 'shadow-md');
      
      // Dopo altri 100ms (quando il pulsante è tornato normale), naviga
      setTimeout(() => {
        setLocation(path);
      }, 100);
    }, 150);
  };

  // Funzione per navigare direttamente (per touch events)
  const navigateDirect = (path: string) => {
    setTimeout(() => setLocation(path), 100);
  };

  return {
    navigateWithButtonReset,
    navigateDirect,
    setLocation
  };
};
