import { useEffect } from 'react';

/**
 * Hook per gestire la navigazione tramite swipe touch
 * Permette di tornare indietro con uno swipe da sinistra a destra
 */
export const useTouchNavigation = () => {
  useEffect(() => {
    let startX = 0;
    let startY = 0;
    let endX = 0;
    let endY = 0;

    const handleTouchStart = (e: TouchEvent) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
    };

    const handleTouchMove = (e: TouchEvent) => {
      endX = e.touches[0].clientX;
      endY = e.touches[0].clientY;
    };

    const handleTouchEnd = () => {
      const deltaX = endX - startX;
      const deltaY = Math.abs(endY - startY);
      
      // Swipe da sinistra a destra (deltaX > 60) e movimento verticale limitato (deltaY < 40)
      if (deltaX > 60 && deltaY < 40) {
        window.history.back();
      }
    };

    // Solo su dispositivi touch
    if ('ontouchstart' in window) {
      window.addEventListener('touchstart', handleTouchStart, { passive: true });
      window.addEventListener('touchmove', handleTouchMove, { passive: true });
      window.addEventListener('touchend', handleTouchEnd, { passive: true });
    }

    return () => {
      if ('ontouchstart' in window) {
        window.removeEventListener('touchstart', handleTouchStart);
        window.removeEventListener('touchmove', handleTouchMove);
        window.removeEventListener('touchend', handleTouchEnd);
      }
    };
  }, []);
};
