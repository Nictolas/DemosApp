import React from 'react';
import { Redirect, useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import { hasAdminCapability, hasDpoCapability, isAdminOnlyPath, isGestisciHomePath } from '@/lib/admin-access';
import VotaReferendum from '@/pages/VotaReferendum';

interface AppWrapperProps {
  children: React.ReactNode;
}

export const AppWrapper: React.FC<AppWrapperProps> = ({ children }) => {
  const [location] = useLocation();
  const { user, isLoading: isAuthLoading } = useAuth();
  // LandingPage already redirects authenticated visitors to /profilo.
  // A second effect-level redirect here triggers a duplicate navigation.

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

  return <>{children}</>;
};
