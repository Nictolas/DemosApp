import { useEffect, useState } from 'react';
import { useAuth } from './use-auth-neon';

export const useMenuReady = () => {
  const { user, isLoading } = useAuth();
  const [isMenuReady, setIsMenuReady] = useState(false);

  useEffect(() => {
    if (user && !isLoading) {
      // Aspetta che il DOM sia completamente renderizzato
      const timer = setTimeout(() => {
        setIsMenuReady(true);
      }, 1500);

      return () => clearTimeout(timer);
    } else {
      setIsMenuReady(false);
    }
  }, [user, isLoading]);

  return isMenuReady;
};
