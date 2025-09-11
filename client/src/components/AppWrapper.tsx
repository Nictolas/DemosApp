import React, { useState, useEffect } from 'react';
import { SplashScreen } from './SplashScreen';

interface AppWrapperProps {
  children: React.ReactNode;
}

export const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
  const [showSplash, setShowSplash] = useState(true);
  const [splashComplete, setSplashComplete] = useState(false);

  // Timer semplice per la splash screen (2 secondi)
  useEffect(() => {
    const splashTimer = setTimeout(() => {
      setSplashComplete(true);
    }, 2000);

    return () => clearTimeout(splashTimer);
  }, []);

  // Mostra la splash screen per 2 secondi, poi mostra sempre l'app
  if (showSplash && !splashComplete) {
    return <SplashScreen onComplete={() => setSplashComplete(true)} duration={2000} />;
  }

  // Dopo la splash screen, mostra sempre l'app (con o senza utente)
  return <>{children}</>;
};