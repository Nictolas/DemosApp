import { useEffect } from 'react';

/**
 * Hook per bloccare completamente lo scroll della pagina
 * @param enabled - Se true, blocca lo scroll. Se false, ripristina lo scroll normale
 */
export function useNoScroll(enabled: boolean = true) {
  useEffect(() => {
    if (enabled) {
      // Salva lo stato originale dello scroll
      const originalStyle = window.getComputedStyle(document.body).overflow;
      const originalHeight = document.body.style.height;
      
      // Blocca lo scroll
      document.body.style.overflow = 'hidden';
      document.body.style.height = '100vh';
      document.documentElement.style.overflow = 'hidden';
      document.documentElement.style.height = '100vh';
      
      // Previeni il touch scroll su mobile
      const preventTouchScroll = (e: TouchEvent) => {
        e.preventDefault();
      };
      
      document.addEventListener('touchmove', preventTouchScroll, { passive: false });
      document.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
      
      // Cleanup function
      return () => {
        // Ripristina lo scroll originale
        document.body.style.overflow = originalStyle;
        document.body.style.height = originalHeight;
        document.documentElement.style.overflow = '';
        document.documentElement.style.height = '';
        
        // Rimuovi gli event listener
        document.removeEventListener('touchmove', preventTouchScroll);
        document.removeEventListener('wheel', (e) => e.preventDefault());
      };
    }
  }, [enabled]);
}
