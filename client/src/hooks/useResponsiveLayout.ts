import { useState, useEffect, useCallback } from 'react';
import { useDeviceDetection, DeviceInfo } from './useDeviceDetection';

export interface ResponsiveLayoutConfig {
  // Configurazioni per i pulsanti del menu
  menuButtonHeight: number;
  menuButtonMinHeight: number;
  menuButtonMaxHeight: number;
  
  // Configurazioni per le card
  cardHeight: number;
  cardMinHeight: number;
  cardMaxHeight: number;
  
  // Configurazioni per i container
  containerPaddingBottom: number;
  containerMinHeight: number;
  
  // Configurazioni per la navbar
  navbarHeight: number;
  navbarPaddingBottom: number;
  
  // Configurazioni per il testo
  textSize: {
    title: string;
    subtitle: string;
    button: string;
  };
  
  // Configurazioni per le icone
  iconSize: {
    small: string;
    medium: string;
    large: string;
  };
  
  // Configurazioni per i gap
  gapSize: string;
  
  // Configurazioni per i margini
  marginSize: string;
}

export const useResponsiveLayout = (): ResponsiveLayoutConfig => {
  const deviceInfo = useDeviceDetection();
  const [config, setConfig] = useState<ResponsiveLayoutConfig>({
    menuButtonHeight: 200,
    menuButtonMinHeight: 120,
    menuButtonMaxHeight: 200,
    cardHeight: 200,
    cardMinHeight: 120,
    cardMaxHeight: 200,
    containerPaddingBottom: 96,
    containerMinHeight: 100,
    navbarHeight: 96,
    navbarPaddingBottom: 16,
    textSize: {
      title: 'text-3xl',
      subtitle: 'text-lg',
      button: 'text-sm'
    },
    iconSize: {
      small: 'h-4 w-4',
      medium: 'h-6 w-6',
      large: 'h-8 w-8'
    },
    gapSize: 'gap-3',
    marginSize: 'mb-3'
  });

  const calculateLayout = useCallback(() => {
    const { viewportHeight, deviceType, hasNotch, safeAreaInsets, isAndroid } = deviceInfo;
    
    // Calcola l'altezza disponibile per il contenuto
    const navbarHeight = 96; // 6rem in pixel
    const headerHeight = 200; // Altezza approssimativa dell'header
    const margins = 80; // Margini e padding vari
    const safeAreaBottom = hasNotch ? safeAreaInsets.bottom : 0;
    
    const availableHeight = viewportHeight - navbarHeight - headerHeight - margins - safeAreaBottom;
    
    // Configurazioni base per tipo dispositivo
    let baseConfig: Partial<ResponsiveLayoutConfig> = {};
    
    switch (deviceType) {
      case 'small-mobile':
        baseConfig = {
          menuButtonHeight: Math.max(80, availableHeight / 2),
          menuButtonMinHeight: 80,
          menuButtonMaxHeight: 120,
          cardHeight: Math.max(100, availableHeight / 2),
          cardMinHeight: 100,
          cardMaxHeight: 150,
          containerPaddingBottom: navbarHeight + 32 + safeAreaBottom,
          textSize: {
            title: 'text-xl',
            subtitle: 'text-sm',
            button: 'text-xs'
          },
          iconSize: {
            small: 'h-3 w-3',
            medium: 'h-4 w-4',
            large: 'h-6 w-6'
          },
          gapSize: 'gap-2',
          marginSize: 'mb-2'
        };
        break;
        
      case 'mobile':
        baseConfig = {
          menuButtonHeight: Math.max(120, availableHeight / 2),
          menuButtonMinHeight: 120,
          menuButtonMaxHeight: 200,
          cardHeight: Math.max(150, availableHeight / 2),
          cardMinHeight: 150,
          cardMaxHeight: 250,
          containerPaddingBottom: navbarHeight + 32 + safeAreaBottom,
          textSize: {
            title: 'text-2xl',
            subtitle: 'text-base',
            button: 'text-sm'
          },
          iconSize: {
            small: 'h-4 w-4',
            medium: 'h-5 w-5',
            large: 'h-7 w-7'
          },
          gapSize: 'gap-3',
          marginSize: 'mb-3'
        };
        break;
        
      case 'tablet':
        baseConfig = {
          menuButtonHeight: Math.max(150, availableHeight / 2),
          menuButtonMinHeight: 150,
          menuButtonMaxHeight: 250,
          cardHeight: Math.max(200, availableHeight / 2),
          cardMinHeight: 200,
          cardMaxHeight: 300,
          containerPaddingBottom: navbarHeight + 48 + safeAreaBottom,
          textSize: {
            title: 'text-3xl',
            subtitle: 'text-lg',
            button: 'text-base'
          },
          iconSize: {
            small: 'h-5 w-5',
            medium: 'h-6 w-6',
            large: 'h-8 w-8'
          },
          gapSize: 'gap-4',
          marginSize: 'mb-4'
        };
        break;
        
      default: // desktop
        baseConfig = {
          menuButtonHeight: Math.max(200, availableHeight / 2),
          menuButtonMinHeight: 200,
          menuButtonMaxHeight: 300,
          cardHeight: Math.max(250, availableHeight / 2),
          cardMinHeight: 250,
          cardMaxHeight: 350,
          containerPaddingBottom: navbarHeight + 64 + safeAreaBottom,
          textSize: {
            title: 'text-4xl',
            subtitle: 'text-xl',
            button: 'text-lg'
          },
          iconSize: {
            small: 'h-6 w-6',
            medium: 'h-7 w-7',
            large: 'h-10 w-10'
          },
          gapSize: 'gap-6',
          marginSize: 'mb-6'
        };
    }
    
    // Aggiustamenti specifici per Android
    if (isAndroid) {
      baseConfig.containerPaddingBottom = (baseConfig.containerPaddingBottom || 0) + 24; // 24px extra per Android
      baseConfig.menuButtonHeight = Math.max(
        baseConfig.menuButtonMinHeight || 120,
        (baseConfig.menuButtonHeight || 200) - 20
      );
    }
    
    // Aggiustamenti per dispositivi con notch
    if (hasNotch) {
      baseConfig.containerPaddingBottom = (baseConfig.containerPaddingBottom || 0) + safeAreaBottom;
    }
    
    setConfig(prev => ({
      ...prev,
      ...baseConfig,
      navbarHeight,
      navbarPaddingBottom: 16 + safeAreaBottom
    }));
  }, [deviceInfo]);

  useEffect(() => {
    calculateLayout();
  }, [calculateLayout]);

  // Ricalcola quando cambiano le dimensioni della finestra
  useEffect(() => {
    const handleResize = () => {
      setTimeout(calculateLayout, 100);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', () => {
      setTimeout(calculateLayout, 500);
    });

    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, [calculateLayout]);

  return config;
};
