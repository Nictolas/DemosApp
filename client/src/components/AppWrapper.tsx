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

  // Timer minimo per la splash screen (3 secondi)
  useEffect(() => {
    const minTimer = setTimeout(() => {
      setMinSplashTimeElapsed(true);
    }, 3000);

    return () => clearTimeout(minTimer);
  }, []);

  // Controlla se l'app è pronta (auth caricato + utente disponibile + tempo minimo trascorso)
  useEffect(() => {
    console.log('🔍 AppWrapper - Stato attuale:', {
      minSplashTimeElapsed,
      isAuthLoading,
      hasUser: !!user,
      userEmail: user?.email
    });

    if (minSplashTimeElapsed && !isAuthLoading) {
      // Se l'utente è presente, l'app è pronta
      if (user) {
        console.log('✅ AppWrapper - Utente presente, nascondendo splash screen');
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
  }, [minSplashTimeElapsed, isAuthLoading, user]);

  // Timer di sicurezza (massimo 8 secondi)
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      setShowSplash(false);
      setIsAppReady(true);
    }, 8000);

    return () => clearTimeout(safetyTimer);
  }, []);

  const handleSplashComplete = () => {
    // Solo se l'app è pronta, completa la splash screen
    if (minSplashTimeElapsed && !isAuthLoading) {
      setShowSplash(false);
      setIsAppReady(true);
    }
  };

  // Mostra la splash screen se necessario
  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} duration={4000} />;
  }

  // Mostra l'app quando è pronta
  if (isAppReady) {
    return <>{children}</>;
  }

  // Fallback: mostra l'app comunque dopo il timer di sicurezza
  return <>{children}</>;
};
