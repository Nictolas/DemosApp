import { useEffect } from 'react';

export const useMobileFix = () => {
  useEffect(() => {
    const fixMobileLayout = () => {
      // Rileva se è un dispositivo Android
      const userAgent = navigator.userAgent.toLowerCase();
      const isAndroid = userAgent.includes('android');
      
      if (isAndroid) {
        // Aggiungi classe Android al body per CSS specifico
        document.body.classList.add('android-device');
        
        // Calcola l'altezza effettiva della navbar
        const navbar = document.querySelector('nav[class*="fixed"]');
        if (navbar) {
          const navbarHeight = navbar.getBoundingClientRect().height;
          
          // Applica padding extra a tutti i container delle pagine
          const containers = document.querySelectorAll('.page-with-navbar .container');
          containers.forEach(container => {
            const element = container as HTMLElement;
            const currentPadding = element.style.paddingBottom || '';
            const extraPadding = '3rem'; // 48px extra per Android
            
            if (!currentPadding.includes(extraPadding)) {
              element.style.paddingBottom = `calc(${navbarHeight}px + ${extraPadding})`;
            }
          });
          
          // Applica altezza ridotta alle card
          const cards = document.querySelectorAll('.menu-button, .rappresentante-card, .candidato-card');
          cards.forEach(card => {
            const element = card as HTMLElement;
            const viewportHeight = window.innerHeight;
            const availableHeight = viewportHeight - navbarHeight - 200; // 200px per header e margini
            const cardHeight = Math.max(120, availableHeight / 2); // Minimo 120px
            
            element.style.height = `${cardHeight}px`;
            element.style.maxHeight = '200px';
          });
        }
      }
    };

    // Applica la correzione immediatamente
    fixMobileLayout();
    
    // Riapplica quando la finestra cambia dimensione
    window.addEventListener('resize', fixMobileLayout);
    window.addEventListener('orientationchange', () => {
      setTimeout(fixMobileLayout, 100);
    });

    return () => {
      window.removeEventListener('resize', fixMobileLayout);
      window.removeEventListener('orientationchange', fixMobileLayout);
    };
  }, []);
};
