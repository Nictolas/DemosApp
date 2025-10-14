import React, { useEffect } from 'react';
import { useDeviceDetection } from '@/hooks/useDeviceDetection';

interface DeviceSpecificProviderProps {
  children: React.ReactNode;
}

export const DeviceSpecificProvider: React.FC<DeviceSpecificProviderProps> = ({ children }) => {
  const deviceInfo = useDeviceDetection();

  useEffect(() => {
    const root = document.documentElement;
    
    // Applica CSS variables basate sul dispositivo
    const applyDeviceSpecificStyles = () => {
      // Reset delle variabili
      root.style.removeProperty('--navbar-height');
      root.style.removeProperty('--navbar-height-mobile');
      root.style.removeProperty('--navbar-height-tablet');
      root.style.removeProperty('--navbar-height-desktop');
      root.style.removeProperty('--safe-area-bottom');
      root.style.removeProperty('--navbar-total-height');
      
      // Applica altezze specifiche per dispositivo
      if (deviceInfo.isMobile) {
        if (deviceInfo.isAndroid) {
          // Android ha spesso navbar più alte
          root.style.setProperty('--navbar-height-mobile', '7rem'); // 112px
        } else if (deviceInfo.isIOS && deviceInfo.hasNotch) {
          // iOS con notch
          root.style.setProperty('--navbar-height-mobile', '6rem'); // 96px
        } else {
          // Mobile standard
          root.style.setProperty('--navbar-height-mobile', '6rem'); // 96px
        }
        root.style.setProperty('--navbar-height', 'var(--navbar-height-mobile)');
      } else if (deviceInfo.isTablet) {
        root.style.setProperty('--navbar-height', 'var(--navbar-height-tablet)');
      } else if (deviceInfo.isDesktop) {
        root.style.setProperty('--navbar-height', 'var(--navbar-height-desktop)');
      }
      
      // Aggiorna safe area bottom
      const safeAreaBottom = getComputedStyle(root).getPropertyValue('--safe-area-bottom');
      root.style.setProperty('--navbar-total-height', `calc(var(--navbar-height) + ${safeAreaBottom})`);
      
      // Applica classe dispositivo al body per CSS specifici
      document.body.className = document.body.className.replace(/device-\w+/g, '');
      document.body.classList.add(`device-${deviceInfo.deviceClass}`);
      
      // Debug info (rimuovi in produzione)
      if (process.env.NODE_ENV === 'development') {
        console.log('🔧 Device Detection:', {
          deviceClass: deviceInfo.deviceClass,
          isMobile: deviceInfo.isMobile,
          isAndroid: deviceInfo.isAndroid,
          isIOS: deviceInfo.isIOS,
          hasNotch: deviceInfo.hasNotch,
          screenHeight: deviceInfo.screenHeight,
          screenWidth: deviceInfo.screenWidth,
          navbarHeight: getComputedStyle(root).getPropertyValue('--navbar-height'),
          safeAreaBottom: safeAreaBottom,
        });
      }
    };

    applyDeviceSpecificStyles();
    
    // Riapplica quando cambiano le dimensioni
    const handleResize = () => {
      setTimeout(applyDeviceSpecificStyles, 100);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [deviceInfo]);

  return <>{children}</>;
};