import React, { useState, useEffect } from 'react';
import { Redirect, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { hasAdminCapability, hasDpoCapability, isAdminOnlyPath, isGestisciHomePath } from '@/lib/admin-access';
import VotaReferendum from '@/pages/VotaReferendum';
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

  useEffect(() => {
    if (!isAuthLoading && isAppReady) {
      // L'app è pronta, non serve altro
    }
  }, [isAuthLoading, isAppReady]);

  useEffect(() => {
    if (!isAuthLoading && user && location === '/') {
      setLocation('/profilo');
    }
  }, [isAuthLoading, user, location, setLocation]);

  if (showSplash) {
    return <SplashScreen onComplete={() => {}} duration={2000} />;
  }

  // F12-36: nuova superficie semanticamente distinta dalla vecchia priorità referendum.
  // È gestita qui finché il router legacy di App.tsx non viene modularizzato.
  if (location === '/vota-referendum') {
    if (isAuthLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      );
    }
    if (!user) {
      return <Redirect to="/auth" />;
    }
    return <VotaReferendum />;
  }

  // Le superfici amministrative sono capability-only anche lato client.
  // Le API sensibili continuano comunque ad applicare requireAdmin server-side.
  if (isAdminOnlyPath(location)) {
    if (isAuthLoading) {
      return (
        <div className="flex min-h-screen items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
        </div>
      );
    }

    if (!user) {
      return <Redirect to="/auth" />;
    }

    if (!hasAdminCapability(user) && !(isGestisciHomePath(location) && hasDpoCapability(user))) {
      return <Redirect to="/preferiti" />;
    }
  }

  if (isAppReady) {
    return <>{children}</>;
  }

  return <>{children}</>;
};
