import { useEffect, useState } from 'react';

export const useNavbarHeight = () => {
  const [navbarHeight, setNavbarHeight] = useState(120); // Default più alto per sicurezza
  const [isAndroid, setIsAndroid] = useState(false);

  useEffect(() => {
    // Rileva se è un dispositivo Android
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroidDevice = userAgent.includes('android');
    setIsAndroid(isAndroidDevice);

    const calculateNavbarHeight = () => {
      // Cerca l'elemento navbar
      const navbar = document.querySelector('nav[class*="fixed"]');
      if (navbar) {
        const height = navbar.getBoundingClientRect().height;
        // Su Android aggiungi padding extra per compensare le differenze
        const extraPadding = isAndroidDevice ? 32 : 16; // Padding extra per tutti i dispositivi
        const calculatedHeight = Math.max(height + extraPadding, 120); // Minimo 120px
        setNavbarHeight(calculatedHeight);
        console.log('🔍 Navbar height calculated:', { height, extraPadding, calculatedHeight, isAndroidDevice });
      } else {
        // Fallback se la navbar non è trovata
        const fallbackHeight = isAndroidDevice ? 140 : 120;
        setNavbarHeight(fallbackHeight);
        console.log('🔍 Navbar not found, using fallback height:', fallbackHeight);
      }
    };

    // Calcola l'altezza iniziale
    calculateNavbarHeight();

    // Ricalcola quando la finestra cambia dimensione
    window.addEventListener('resize', calculateNavbarHeight);
    window.addEventListener('orientationchange', calculateNavbarHeight);

    // Ricalcola dopo un breve delay per assicurarsi che il DOM sia pronto
    const timeoutId = setTimeout(calculateNavbarHeight, 100);
    const timeoutId2 = setTimeout(calculateNavbarHeight, 500); // Secondo timeout per sicurezza

    return () => {
      window.removeEventListener('resize', calculateNavbarHeight);
      window.removeEventListener('orientationchange', calculateNavbarHeight);
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
    };
  }, [isAndroid]);

  return { navbarHeight, isAndroid };
};
