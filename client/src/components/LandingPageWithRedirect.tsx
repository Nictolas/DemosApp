import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth-neon';
import LandingPage from '@/pages/LandingPage';

export const LandingPageWithRedirect = () => {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();

  // Se l'utente è autenticato, reindirizza al menu
  if (!isLoading && user) {
    console.log('✅ LandingPageWithRedirect - Utente autenticato, reindirizzando a /menu');
    setLocation('/menu');
    return null;
  }

  // Altrimenti mostra la landing page normale
  return <LandingPage />;
};
