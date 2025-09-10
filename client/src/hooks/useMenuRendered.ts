import { useEffect, useState } from 'react';
import { useAuth } from './use-auth-neon';

export const useMenuRendered = () => {
  const { user, isLoading } = useAuth();
  const [isMenuRendered, setIsMenuRendered] = useState(false);

  useEffect(() => {
    if (user && !isLoading) {
      // Controlla se il Menu è effettivamente renderizzato nel DOM
      const checkMenuRendered = () => {
        // Cerca elementi specifici del Menu nel DOM
        const menuTitle = document.querySelector('[data-testid="menu-title"], .menu-title, h1');
        const menuButtons = document.querySelectorAll('[data-testid="menu-button"], .menu-button, button[class*="menu"]');
        const menuLogo = document.querySelector('[data-testid="menu-logo"], .menu-logo, img[alt*="DEMOS"], img[alt*="Demos"]');
        
        // Il menu è considerato renderizzato se ha almeno il titolo e alcuni pulsanti
        const hasTitle = menuTitle && menuTitle.textContent?.includes('Menu');
        const hasButtons = menuButtons.length >= 2; // Almeno 2 pulsanti
        const hasLogo = !!menuLogo;
        
        const isRendered = hasTitle && hasButtons;
        
        console.log('🔍 useMenuRendered - Controllo DOM:', {
          hasTitle,
          hasButtons: menuButtons.length,
          hasLogo,
          isRendered,
          menuTitleText: menuTitle?.textContent,
          buttonCount: menuButtons.length
        });
        
        return isRendered;
      };

      // Controlla immediatamente
      if (checkMenuRendered()) {
        setIsMenuRendered(true);
        return;
      }

      // Se non è renderizzato, controlla periodicamente
      const interval = setInterval(() => {
        if (checkMenuRendered()) {
          setIsMenuRendered(true);
          clearInterval(interval);
        }
      }, 100); // Controlla ogni 100ms

      // Timeout di sicurezza dopo 5 secondi
      const timeout = setTimeout(() => {
        console.log('⚠️ useMenuRendered - Timeout raggiunto, forzando menu renderizzato');
        setIsMenuRendered(true);
        clearInterval(interval);
      }, 5000);

      return () => {
        clearInterval(interval);
        clearTimeout(timeout);
      };
    } else {
      setIsMenuRendered(false);
    }
  }, [user, isLoading]);

  return isMenuRendered;
};
