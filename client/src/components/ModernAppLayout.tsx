import React from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth';
import Navbar from './Navbar';

interface ModernAppLayoutProps {
  children: React.ReactNode;
}

export const ModernAppLayout: React.FC<ModernAppLayoutProps> = ({ children }) => {
  const [location] = useLocation();
  const { user } = useAuth();

  // Determina se mostrare la navbar
  const shouldShowNavbar = location !== '/' && 
    !location.startsWith('/auth') && 
    !location.startsWith('/reset-password') && 
    !location.startsWith('/registrazione') && 
    !location.startsWith('/verifica-email') && 
    !location.startsWith('/conferma-email') && 
    !location.startsWith('/privacy-policy') && 
    !location.startsWith('/terms-of-service') && 
    !location.startsWith('/cookie-policy') && 
    location !== '/gdpr';

  return (
    <div className="modern-app-layout">
      {/* Header area - per eventuali header fissi */}
      <header className="app-header">
        {/* Header content se necessario */}
      </header>
      
      {/* Main content area */}
      <main className="app-main">
        {children}
      </main>
      
      {/* Navbar area */}
      {shouldShowNavbar && (
        <nav className="app-navbar">
          <Navbar />
        </nav>
      )}
    </div>
  );
};
