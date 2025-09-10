import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth-neon';
import { SplashScreen } from './SplashScreen';

interface AppWrapperProps {
  children: React.ReactNode;
}

export const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const [showSplash, setShowSplash] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);
  const [minSplashTimeElapsed, setMinSplashTimeElapsed] = useState(false);
  const [userStable, setUserStable] = useState(false);
  const [menuReady, setMenuReady] = useState(false);

  // Timer minimo per la splash screen (8 secondi - molto più lungo)
  useEffect(() => {
    const minTimer = setTimeout(() => {
      setMinSplashTimeElapsed(true);
    }, 8000);

    return () => clearTimeout(minTimer);
  }, []);

  // Controlla che l'utente sia stabile (non cambi per almeno 3 secondi)
  useEffect(() => {
    if (user) {
      const stabilityTimer = setTimeout(() => {
        setUserStable(true);
      }, 3000);

      return () => clearTimeout(stabilityTimer);
    } else {
      setUserStable(false);
    }
  }, [user]);

  // Timer per il menu ready (5 secondi dopo che l'utente è stabile)
  useEffect(() => {
    if (userStable && user) {
      const menuTimer = setTimeout(() => {
        setMenuReady(true);
      }, 5000);

      return () => clearTimeout(menuTimer);
    } else {
      setMenuReady(false);
    }
  }, [userStable, user]);

  // Controlla se l'app è pronta (tutti i controlli devono essere soddisfatti)
  useEffect(() => {
    console.log('🔍 AppWrapper - Stato attuale:', {
      minSplashTimeElapsed,
      isAuthLoading,
      hasUser: !!user,
      userEmail: user?.email,
      userStable,
      menuReady
    });

    if (minSplashTimeElapsed && !isAuthLoading && userStable && menuReady) {
      // Se tutti i controlli sono soddisfatti, l'app è pronta
      if (user) {
        console.log('✅ AppWrapper - Tutto pronto, nascondendo splash screen');
        const finalTimer = setTimeout(() => {
          setShowSplash(false);
          setIsAppReady(true);
        }, 1000); // 1000ms extra per transizione fluida

        return () => clearTimeout(finalTimer);
      }
      // Se l'utente non è presente ma l'auth è finito, mostra l'app comunque
      // (per gestire il caso di utenti non autenticati)
      else {
        console.log('⚠️ AppWrapper - Nessun utente ma auth finito, mostrando app');
        setShowSplash(false);
        setIsAppReady(true);
      }
    }
  }, [minSplashTimeElapsed, isAuthLoading, user, userStable, menuReady]);

  // Timer di sicurezza (massimo 20 secondi)
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setShowSplash(false);
      setIsAppReady(true);
    }, 20000);

    return () => clearTimeout(safetyTimer);
  }, []);

  const handleSplashComplete = () => {
    // Solo se l'app è pronta, completa la splash screen
    if (minSplashTimeElapsed && !isAuthLoading && userStable && menuReady) {
      setShowSplash(false);
      setIsAppReady(true);
    }
  };

  // Mostra la splash screen se necessario
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} duration={10000} />;
  }

  // Mostra l'app quando è pronta
  if (isAppReady) {
    return <>{children}</>;
  }

  // Fallback: mostra l'app comunque dopo il timer di sicurezza
  return <>{children}</>;
};
