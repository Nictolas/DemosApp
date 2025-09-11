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
  const [splashComplete, setSplashComplete] = useState(false);

  console.log('🔍 AppWrapper - Stato attuale:', {
    location,
    showSplash,
    splashComplete,
    isAuthLoading,
    hasUser: !!user,
    userEmail: user?.email
  });

  // Timer per la splash screen (3 secondi)
  useEffect(() => {
    console.log('⏰ AppWrapper - Avvio timer splash screen');
    const splashTimer = setTimeout(() => {
      console.log('✅ AppWrapper - Timer splash screen completato');
      setSplashComplete(true);
    }, 3000);

    return () => clearTimeout(splashTimer);
  }, []);

  // Redirect automatico se l'utente è autenticato e siamo sulla home
  useEffect(() => {
    if (!isAuthLoading && user && location === '/') {
      console.log('🔄 AppWrapper - Utente autenticato, reindirizzando a /menu');
      setLocation('/menu');
    }
  }, [isAuthLoading, user, location, setLocation]);

  // Mostra la splash screen per 3 secondi, poi mostra sempre l'app
  if (showSplash && !splashComplete) {
    console.log('🖼️ AppWrapper - Mostrando splash screen');
    return <SplashScreen onComplete={() => setSplashComplete(true)} duration={3000} />;
  }

  // Dopo la splash screen, mostra sempre l'app
  console.log('🚀 AppWrapper - Mostrando children (app)');
  return <>{children}</>;
};