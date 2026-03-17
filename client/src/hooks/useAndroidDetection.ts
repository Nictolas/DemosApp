import { useEffect } from 'react';

export const useAndroidDetection = () => {
  useEffect(() => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isAndroid = /android/.test(userAgent);
    
    if (isAndroid) {
      // Aggiungi classe Android al body
      document.body.classList.add('android-device');
      
      // Rileva dimensioni schermo per debug
      const screenWidth = window.innerWidth;
      const screenHeight = window.innerHeight;
      
      // Aggiungi classe specifica per dimensioni schermo
      if (screenWidth <= 720 && screenHeight <= 1600) {
        document.body.classList.add('android-small-screen');
      } else if (screenWidth <= 1080 && screenHeight <= 2400) {
        document.body.classList.add('android-medium-screen');
      } else {
        document.body.classList.add('android-large-screen');
      }
      
      // Debug info in console (solo in sviluppo)
      if (process.env.NODE_ENV === 'development') {
        console.log('🤖 Android rilevato:', {
          userAgent: navigator.userAgent,
          screenWidth,
          screenHeight,
          classes: document.body.className
        });
      }
    }
    
    // Cleanup
    return () => {
      document.body.classList.remove('android-device', 'android-small-screen', 'android-medium-screen', 'android-large-screen');
    };
  }, []);
};
