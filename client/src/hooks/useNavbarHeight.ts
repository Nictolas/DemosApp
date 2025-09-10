import { useEffect, useState } from 'react';

export const useNavbarHeight = () => {
  const [navbarHeight, setNavbarHeight] = useState(96); // Default 6rem = 96px

  useEffect(() => {
    const calculateNavbarHeight = () => {
      // Cerca l'elemento navbar
      const navbar = document.querySelector('nav[class*="fixed"]');
      if (navbar) {
        const height = navbar.getBoundingClientRect().height;
        setNavbarHeight(height);
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
  }, []);

  return navbarHeight;
};
