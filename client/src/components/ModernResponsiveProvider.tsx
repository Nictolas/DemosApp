import React, { createContext, useContext, useEffect } from 'react';
import { useModernResponsiveLayout, ModernLayoutConfig } from '@/hooks/useModernResponsiveLayout';

interface ModernResponsiveContextType {
  layoutConfig: ModernLayoutConfig;
  applyModernStyles: () => void;
}

const ModernResponsiveContext = createContext<ModernResponsiveContextType | undefined>(undefined);

export const useModernResponsiveContext = () => {
  const context = useContext(ModernResponsiveContext);
  if (!context) {
    throw new Error('useModernResponsiveContext must be used within a ModernResponsiveProvider');
  }
  return context;
};

interface ModernResponsiveProviderProps {
  children: React.ReactNode;
}

export const ModernResponsiveProvider: React.FC<ModernResponsiveProviderProps> = ({ children }) => {
  const layoutConfig = useModernResponsiveLayout();

  const applyModernStyles = () => {
    const root = document.documentElement;
    
    // Applica variabili CSS moderne
    root.style.setProperty('--menu-button-height', `${layoutConfig.menuButtonHeight}px`);
    root.style.setProperty('--menu-button-min-height', `${layoutConfig.menuButtonMinHeight}px`);
    root.style.setProperty('--menu-button-max-height', `${layoutConfig.menuButtonMaxHeight}px`);
    root.style.setProperty('--container-padding-bottom', `${layoutConfig.containerPaddingBottom}px`);
    root.style.setProperty('--grid-gap', `${layoutConfig.gridGap}px`);
    root.style.setProperty('--available-height', `${layoutConfig.availableHeight}px`);
    
    // Applica classe categoria dispositivo
    const body = document.body;
    body.classList.remove('device-small-phone', 'device-phone', 'device-large-phone', 'device-tablet', 'device-desktop');
    body.classList.add(`device-${layoutConfig.deviceCategory}`);
    
    // Applica stili direttamente agli elementi
    const menuButtons = document.querySelectorAll('.menu-button');
    menuButtons.forEach(button => {
      const element = button as HTMLElement;
      element.style.height = `${layoutConfig.menuButtonHeight}px`;
      element.style.minHeight = `${layoutConfig.menuButtonMinHeight}px`;
      element.style.maxHeight = `${layoutConfig.menuButtonMaxHeight}px`;
    });
    
    const containers = document.querySelectorAll('.page-with-navbar .container, .menu-page .container');
    containers.forEach(container => {
      const element = container as HTMLElement;
      element.style.paddingBottom = `${layoutConfig.containerPaddingBottom}px`;
    });
    
    const grids = document.querySelectorAll('.menu-grid');
    grids.forEach(grid => {
      const element = grid as HTMLElement;
      element.style.gap = `${layoutConfig.gridGap}px`;
    });
  };

  useEffect(() => {
    applyModernStyles();
  }, [layoutConfig]);

  const contextValue: ModernResponsiveContextType = {
    layoutConfig,
    applyModernStyles
  };

  return (
    <ModernResponsiveContext.Provider value={contextValue}>
      {children}
    </ModernResponsiveContext.Provider>
  );
};
