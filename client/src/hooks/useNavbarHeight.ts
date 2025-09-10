import { useEffect, useState } from 'react';

export const useNavbarHeight = () => {
  const [navbarHeight, setNavbarHeight] = useState(96); // Default 6rem = 96px
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
        const extraPadding = isAndroidDevice ? 32 : 0; // 32px extra per Android
        setNavbarHeight(height + extraPadding);
      }
    };

    // Calcola l'altezza iniziale
    calculateNavbarHeight();

    // Ricalcola quando la finestra cambia dimensione
    window.addEventListener('resize', calculateNavbarHeight);
    window.addEventListener('orientationchange', calculateNavbarHeight);

    // Ricalcola dopo un breve delay per assicurarsi che il DOM sia pronto
    const timeoutId = setTimeout(calculateNavbarHeight, 100);

    return () => {
      window.removeEventListener('resize', calculateNavbarHeight);
      window.removeEventListener('orientationchange', calculateNavbarHeight);
      clearTimeout(timeoutId);
    };
  }, [isAndroid]);

  return { navbarHeight, isAndroid };
};
