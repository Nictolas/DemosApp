import React, { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/use-auth-neon';
import { useMenuRendered } from '@/hooks/useMenuRendered';
import { SplashScreen } from './SplashScreen';

interface AppWrapperProps {
  children: React.ReactNode;
}

export const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
  const { user, isLoading: isAuthLoading } = useAuth();
  const isMenuRendered = useMenuRendered();
  const [showSplash, setShowSplash] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);
  const [minSplashTimeElapsed, setMinSplashTimeElapsed] = useState(false);
  const [userStable, setUserStable] = useState(false);

  // Timer minimo per la splash screen (5 secondi - aumentato ulteriormente)
  useEffect(() => {
    const minTimer = setTimeout(() => {
      setMinSplashTimeElapsed(true);
    }, 5000);

    return () => clearTimeout(minTimer);
  }, []);

  // Controlla che l'utente sia stabile (non cambi per almeno 2 secondi)
  useEffect(() => {
    if (user) {
      const stabilityTimer = setTimeout(() => {
        setUserStable(true);
      }, 2000);

      return () => clearTimeout(stabilityTimer);
    } else {
      setUserStable(false);
    }
  }, [user]);

  // Controlla se l'app è pronta (auth caricato + utente stabile + menu renderizzato + tempo minimo trascorso)
  useEffect(() => {
    console.log('🔍 AppWrapper - Stato attuale:', {
      minSplashTimeElapsed,
      isAuthLoading,
      hasUser: !!user,
      userEmail: user?.email,
      userStable,
      isMenuRendered
    });

    if (minSplashTimeElapsed && !isAuthLoading && userStable && isMenuRendered) {
      // Se l'utente è presente, stabile e il menu è renderizzato, l'app è pronta
      if (user) {
        console.log('✅ AppWrapper - Menu renderizzato, nascondendo splash screen');
        const finalTimer = setTimeout(() => {
          setShowSplash(false);
          setIsAppReady(true);
        }, 500); // 500ms extra per transizione fluida

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
  }, [minSplashTimeElapsed, isAuthLoading, user, userStable, isMenuRendered]);

  // Timer di sicurezza (massimo 12 secondi)
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setShowSplash(false);
      setIsAppReady(true);
    }, 12000);

    return () => clearTimeout(safetyTimer);
  }, []);

  const handleSplashComplete = () => {
    // Solo se l'app è pronta, completa la splash screen
    if (minSplashTimeElapsed && !isAuthLoading && userStable && isMenuRendered) {
      setShowSplash(false);
      setIsAppReady(true);
    }
  };

  // Mostra la splash screen se necessario
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} duration={6000} />;
  }

  // Mostra l'app quando è pronta
  if (isAppReady) {
    return <>{children}</>;
  }

  // Fallback: mostra l'app comunque dopo il timer di sicurezza
  return <>{children}</>;
};
