import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth-neon';

export const AutoRedirectToMenu: React.FC = () => {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    console.log('🔄 AutoRedirectToMenu - Controllo redirect:', {
      isLoading,
      hasUser: !!user,
      userEmail: user?.email
    });

    // Se l'utente è autenticato e non stiamo caricando, reindirizza al menu
    if (!isLoading && user) {
      console.log('✅ AutoRedirectToMenu - Utente autenticato, reindirizzando a /menu');
      setLocation('/menu');
    }
  }, [user, isLoading, setLocation]);

  // Non renderizza nulla, è solo per il redirect
  return null;
};
