import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { SplashScreen } from './SplashScreen';

interface AppWrapperProps {
  children: React.ReactNode;
}

export const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
  const [location, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);

  // Splash solo al primo caricamento della sessione (mai al toggle Mobile/Desktop)
  useEffect(() => {
    const splashAlreadyShown = sessionStorage.getItem("splash_shown") === "1";
    const isFirstLoad = !sessionStorage.getItem("app_loaded");
    const hasToken = localStorage.getItem("auth_token");

    if (!splashAlreadyShown && (isFirstLoad || hasToken)) {
      setShowSplash(true);
      sessionStorage.setItem("app_loaded", "true");
      sessionStorage.setItem("splash_shown", "1");

      const splashTimer = setTimeout(() => {
        setShowSplash(false);
        setIsAppReady(true);
      }, 2000);

      return () => clearTimeout(splashTimer);
    }

    setIsAppReady(true);
  }, []);

  // Controlla se l'app è pronta (auth completato)
  useEffect(() => {
    if (!isAuthLoading && isAppReady) {
      // L'app è pronta, non serve altro
    }
  }, [isAuthLoading, isAppReady]);

  // Redirect automatico: tutti gli utenti autenticati vanno ai preferiti
  useEffect(() => {
    if (!isAuthLoading && user && location === '/') {
      setLocation('/preferiti');
    }
  }, [isAuthLoading, user, location, setLocation]);

  // Mostra la splash screen solo quando necessario
  if (showSplash) {
    return <SplashScreen onComplete={() => {}} duration={2000} />;
  }

  // Mostra l'app quando è pronta
  if (isAppReady) {
    return <>{children}</>;
  }

  // Fallback: mostra l'app comunque
  return <>{children}</>;
};
