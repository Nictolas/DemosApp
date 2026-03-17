import React, { createContext, useContext, useEffect, useState } from 'react';
import { useDeviceDetection, DeviceInfo } from '@/hooks/useDeviceDetection';
import { useResponsiveLayout, ResponsiveLayoutConfig } from '@/hooks/useResponsiveLayout';

interface ResponsiveLayoutContextType {
  deviceInfo: DeviceInfo;
  layoutConfig: ResponsiveLayoutConfig;
  applyResponsiveStyles: () => void;
  getResponsiveClass: (baseClass: string, type: 'button' | 'card' | 'container' | 'text' | 'icon') => string;
}

const ResponsiveLayoutContext = createContext<ResponsiveLayoutContextType | undefined>(undefined);

export const useResponsiveLayoutContext = () => {
  const context = useContext(ResponsiveLayoutContext);
  if (!context) {
    throw new Error('useResponsiveLayoutContext must be used within a ResponsiveLayoutProvider');
  }
  return context;
};

interface ResponsiveLayoutProviderProps {
  children: React.ReactNode;
}

export const ResponsiveLayoutProvider: React.FC<ResponsiveLayoutProviderProps> = ({ children }) => {
  const deviceInfo = useDeviceDetection();
  const layoutConfig = useResponsiveLayout();
  const [isInitialized, setIsInitialized] = useState(false);

  const applyResponsiveStyles = () => {
    // Applica classi CSS dinamiche al body
    const body = document.body;
    
    // Rimuovi classi precedenti
    body.classList.remove(
      'device-small-mobile',
      'device-mobile', 
      'device-tablet',
      'device-desktop',
      'device-android',
      'device-ios',
      'device-has-notch',
      'device-portrait',
      'device-landscape'
    );
    
    // Aggiungi classi correnti
    body.classList.add(`device-${deviceInfo.deviceType}`);
    
    if (deviceInfo.isAndroid) body.classList.add('device-android');
    if (deviceInfo.isIOS) body.classList.add('device-ios');
    if (deviceInfo.hasNotch) body.classList.add('device-has-notch');
    if (deviceInfo.orientation === 'portrait') body.classList.add('device-portrait');
    if (deviceInfo.orientation === 'landscape') body.classList.add('device-landscape');
    
    // Applica variabili CSS personalizzate
    const root = document.documentElement;
    root.style.setProperty('--menu-button-height', `${layoutConfig.menuButtonHeight}px`);
    root.style.setProperty('--menu-button-min-height', `${layoutConfig.menuButtonMinHeight}px`);
    root.style.setProperty('--menu-button-max-height', `${layoutConfig.menuButtonMaxHeight}px`);
    root.style.setProperty('--card-height', `${layoutConfig.cardHeight}px`);
    root.style.setProperty('--card-min-height', `${layoutConfig.cardMinHeight}px`);
    root.style.setProperty('--card-max-height', `${layoutConfig.cardMaxHeight}px`);
    root.style.setProperty('--container-padding-bottom', `${layoutConfig.containerPaddingBottom}px`);
    root.style.setProperty('--navbar-height', `${layoutConfig.navbarHeight}px`);
    root.style.setProperty('--navbar-padding-bottom', `${layoutConfig.navbarPaddingBottom}px`);
    root.style.setProperty('--safe-area-inset-bottom', `${deviceInfo.safeAreaInsets.bottom}px`);
    
    // Applica stili specifici per i pulsanti del menu
    const menuButtons = document.querySelectorAll('.menu-button');
    menuButtons.forEach(button => {
      const element = button as HTMLElement;
      element.style.height = `${layoutConfig.menuButtonHeight}px`;
      element.style.minHeight = `${layoutConfig.menuButtonMinHeight}px`;
      element.style.maxHeight = `${layoutConfig.menuButtonMaxHeight}px`;
    });
    
    // Applica stili per le card
    const cards = document.querySelectorAll('.candidato-card, .rappresentante-card, .ministero-card');
    cards.forEach(card => {
      const element = card as HTMLElement;
      element.style.height = `${layoutConfig.cardHeight}px`;
      element.style.minHeight = `${layoutConfig.cardMinHeight}px`;
      element.style.maxHeight = `${layoutConfig.cardMaxHeight}px`;
    });
    
    // Applica padding ai container
    const containers = document.querySelectorAll('.page-with-navbar .container, .menu-page .container');
    containers.forEach(container => {
      const element = container as HTMLElement;
      element.style.paddingBottom = `${layoutConfig.containerPaddingBottom}px`;
    });
    
    // Applica altezza minima alle pagine
    const pages = document.querySelectorAll('.menu-page, .opinioni-page');
    pages.forEach(page => {
      const element = page as HTMLElement;
      element.style.minHeight = `calc(100vh - ${layoutConfig.navbarHeight}px - var(--safe-area-inset-bottom))`;
    });
  };

  const getResponsiveClass = (baseClass: string, type: 'button' | 'card' | 'container' | 'text' | 'icon'): string => {
    const classes = [baseClass];
    
    switch (type) {
      case 'button':
        classes.push('responsive-button');
        break;
      case 'card':
        classes.push('responsive-card');
        break;
      case 'container':
        classes.push('responsive-container');
        break;
      case 'text':
        classes.push(layoutConfig.textSize.title);
        break;
      case 'icon':
        classes.push(layoutConfig.iconSize.medium);
        break;
    }
    
    return classes.join(' ');
  };

  useEffect(() => {
    if (deviceInfo.screenWidth > 0) {
      applyResponsiveStyles();
      setIsInitialized(true);
    }
  }, [deviceInfo, layoutConfig]);

  const contextValue: ResponsiveLayoutContextType = {
    deviceInfo,
    layoutConfig,
    applyResponsiveStyles,
    getResponsiveClass
  };

  return (
    <ResponsiveLayoutContext.Provider value={contextValue}>
      {children}
    </ResponsiveLayoutContext.Provider>
  );
};
