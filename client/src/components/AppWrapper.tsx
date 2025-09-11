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
  const [showSplash, setShowSplash] = useState(true);
  const [isAppReady, setIsAppReady] = useState(false);
  const [minSplashTimeElapsed, setMinSplashTimeElapsed] = useState(false);

  console.log('🔍 AppWrapper - Stato attuale:', {
    location,
    showSplash,
    isAppReady,
    minSplashTimeElapsed,
    isAuthLoading,
    hasUser: !!user,
    userEmail: user?.email
  });

  // Timer minimo per la splash screen (4 secondi)
  useEffect(() => {
    console.log('⏰ AppWrapper - Avvio timer minimo splash screen');
    const minTimer = setTimeout(() => {
      console.log('✅ AppWrapper - Timer minimo splash screen completato');
      setMinSplashTimeElapsed(true);
    }, 4000);

    return () => clearTimeout(minTimer);
  }, []);

  // Controlla se l'app è pronta (auth completato + tempo minimo trascorso)
  useEffect(() => {
    if (minSplashTimeElapsed && !isAuthLoading) {
      console.log('✅ AppWrapper - App pronta, nascondendo splash screen');
      const finalTimer = setTimeout(() => {
        setShowSplash(false);
        setIsAppReady(true);
      }, 500); // 500ms per transizione fluida

      return () => clearTimeout(finalTimer);
    }
  }, [minSplashTimeElapsed, isAuthLoading]);

  // Redirect automatico se l'utente è autenticato e siamo sulla home
  useEffect(() => {
    if (!isAuthLoading && user && location === '/') {
      console.log('🔄 AppWrapper - Utente autenticato, reindirizzando a /menu');
      setLocation('/menu');
    }
  }, [isAuthLoading, user, location, setLocation]);

  // Timer di sicurezza (massimo 8 secondi)
  useEffect(() => {
    const safetyTimer = setTimeout(() => {
      console.log('⚠️ AppWrapper - Timer di sicurezza scaduto, nascondendo splash screen');
      setShowSplash(false);
      setIsAppReady(true);
    }, 8000);

    return () => clearTimeout(safetyTimer);
  }, []);

  // Mostra la splash screen finché l'app non è pronta
  if (showSplash) {
    console.log('🖼️ AppWrapper - Mostrando splash screen');
    return <SplashScreen onComplete={() => {}} duration={8000} />;
  }

  // Mostra l'app quando è pronta
  if (isAppReady) {
    console.log('🚀 AppWrapper - Mostrando children (app)');
    return <>{children}</>;
  }

  // Fallback: mostra l'app comunque
  console.log('⚠️ AppWrapper - Fallback: mostrando app');
  return <>{children}</>;
};