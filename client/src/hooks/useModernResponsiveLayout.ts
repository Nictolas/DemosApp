import { useState, useEffect, useCallback } from 'react';

export interface ModernLayoutConfig {
  // Viewport info
  viewportHeight: number;
  viewportWidth: number;
  availableHeight: number;
  
  // Layout calculations
  menuButtonHeight: number;
  menuButtonMinHeight: number;
  menuButtonMaxHeight: number;
  
  // Container settings
  containerPaddingBottom: number;
  navbarHeight: number;
  
  // Grid settings
  gridRows: number;
  gridGap: number;
  
  // Device category
  deviceCategory: 'small-phone' | 'phone' | 'large-phone' | 'tablet' | 'desktop';
}

export const useModernResponsiveLayout = (): ModernLayoutConfig => {
  const [config, setConfig] = useState<ModernLayoutConfig>({
    viewportHeight: 0,
    viewportWidth: 0,
    availableHeight: 0,
    menuButtonHeight: 200,
    menuButtonMinHeight: 120,
    menuButtonMaxHeight: 200,
    containerPaddingBottom: 96,
    navbarHeight: 96,
    gridRows: 2,
    gridGap: 12,
    deviceCategory: 'phone'
  });

  const calculateLayout = useCallback(() => {
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    
    // Categorizza il dispositivo basandosi su viewport
    let deviceCategory: ModernLayoutConfig['deviceCategory'] = 'phone';
    if (viewportWidth < 360) deviceCategory = 'small-phone';
    else if (viewportWidth >= 360 && viewportWidth < 414) deviceCategory = 'phone';
    else if (viewportWidth >= 414 && viewportWidth < 768) deviceCategory = 'large-phone';
    else if (viewportWidth >= 768 && viewportWidth < 1024) deviceCategory = 'tablet';
    else deviceCategory = 'desktop';
    
    // Calcola altezza disponibile
    const navbarHeight = 96; // 6rem
    const headerHeight = 200; // Altezza header approssimativa
    const margins = 80; // Margini e padding
    const safeAreaBottom = parseInt(getComputedStyle(document.documentElement)
      .getPropertyValue('--safe-area-inset-bottom') || '0');
    
    const availableHeight = viewportHeight - navbarHeight - headerHeight - margins - safeAreaBottom;
    
    // Configurazioni per categoria dispositivo
    let baseConfig: Partial<ModernLayoutConfig> = {};
    
    switch (deviceCategory) {
      case 'small-phone':
        baseConfig = {
          menuButtonHeight: Math.max(80, availableHeight / 2),
          menuButtonMinHeight: 80,
          menuButtonMaxHeight: 120,
          containerPaddingBottom: navbarHeight + 32 + safeAreaBottom,
          gridRows: 2,
          gridGap: 8
        };
        break;
        
      case 'phone':
        baseConfig = {
          menuButtonHeight: Math.max(120, availableHeight / 2),
          menuButtonMinHeight: 120,
          menuButtonMaxHeight: 200,
          containerPaddingBottom: navbarHeight + 32 + safeAreaBottom,
          gridRows: 2,
          gridGap: 12
        };
        break;
        
      case 'large-phone':
        baseConfig = {
          menuButtonHeight: Math.max(150, availableHeight / 2),
          menuButtonMinHeight: 150,
          menuButtonMaxHeight: 250,
          containerPaddingBottom: navbarHeight + 40 + safeAreaBottom,
          gridRows: 2,
          gridGap: 16
        };
        break;
        
      case 'tablet':
        baseConfig = {
          menuButtonHeight: Math.max(180, availableHeight / 2),
          menuButtonMinHeight: 180,
          menuButtonMaxHeight: 280,
          containerPaddingBottom: navbarHeight + 48 + safeAreaBottom,
          gridRows: 2,
          gridGap: 20
        };
        break;
        
      case 'desktop':
        baseConfig = {
          menuButtonHeight: Math.max(200, availableHeight / 2),
          menuButtonMinHeight: 200,
          menuButtonMaxHeight: 300,
          containerPaddingBottom: navbarHeight + 64 + safeAreaBottom,
          gridRows: 2,
          gridGap: 24
        };
        break;
    }
    
    setConfig({
      viewportHeight,
      viewportWidth,
      availableHeight,
      navbarHeight,
      ...baseConfig
    } as ModernLayoutConfig);
  }, []);

  useEffect(() => {
    calculateLayout();
    
    const handleResize = () => {
      setTimeout(calculateLayout, 100);
    };
    
    const handleOrientationChange = () => {
      setTimeout(calculateLayout, 500);
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleOrientationChange);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleOrientationChange);
    };
  }, [calculateLayout]);

  return config;
};
