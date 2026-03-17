import React, { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth-neon';
import { SplashScreen } from './SplashScreen';

interface AppWrapperProps {
  children: React.ReactNode;
}

export const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
  const [location, setLocation] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(false);
  const [isAppReady, setIsAppReady] = useState(false);
  const [hasShownSplash, setHasShownSplash] = useState(false);

  // Controlla se è il primo caricamento dell'app
  useEffect(() => {
    const isFirstLoad = !sessionStorage.getItem('app_loaded');
    const hasToken = localStorage.getItem('auth_token');
    
    // Mostra splash screen solo se:
    // 1. È il primo caricamento dell'app
    // 2. L'utente ha un token (login recente)
    // 3. Non abbiamo ancora mostrato lo splash in questa sessione
    if (isFirstLoad || (hasToken && !hasShownSplash)) {
      setShowSplash(true);
      setHasShownSplash(true);
      sessionStorage.setItem('app_loaded', 'true');
      
      // Timer per la splash screen (2 secondi invece di 8)
      const splashTimer = setTimeout(() => {
        setShowSplash(false);
        setIsAppReady(true);
      }, 2000);

      return () => clearTimeout(splashTimer);
    } else {
      // Se non dobbiamo mostrare lo splash, l'app è subito pronta
      setIsAppReady(true);
    }
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
