import React, { useState, useEffect } from 'react';
import { SplashScreen } from './SplashScreen';

interface AppWrapperProps {
  children: React.ReactNode;
}

export const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
  const [showSplash, setShowSplash] = useState(true);
  const [splashComplete, setSplashComplete] = useState(false);

  console.log('🔍 AppWrapper - Stato attuale:', {
    showSplash,
    splashComplete,
    childrenType: typeof children
  });

  // Timer semplice per la splash screen (2 secondi)
  useEffect(() => {
    console.log('⏰ AppWrapper - Avvio timer splash screen');
    const splashTimer = setTimeout(() => {
      console.log('✅ AppWrapper - Timer splash screen completato');
      setSplashComplete(true);
    }, 2000);

    return () => clearTimeout(splashTimer);
  }, []);

  // Mostra la splash screen per 2 secondi, poi mostra sempre l'app
  if (showSplash && !splashComplete) {
    console.log('🖼️ AppWrapper - Mostrando splash screen');
    return <SplashScreen onComplete={() => setSplashComplete(true)} duration={2000} />;
  }

  // Dopo la splash screen, mostra sempre l'app (con o senza utente)
  console.log('🚀 AppWrapper - Mostrando children (app)');
  return <>{children}</>;
};