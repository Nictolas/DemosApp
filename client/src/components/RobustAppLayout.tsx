import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth-neon';
import { useAndroidDetection } from '@/hooks/useAndroidDetection';
import Navbar from './Navbar';
import { ErrorBoundary } from './ErrorBoundary';

interface RobustAppLayoutProps {
  children: React.ReactNode;
}

export const RobustAppLayout: React.FC<RobustAppLayoutProps> = ({ children }) => {
  const [location] = useLocation();
  const { user } = useAuth();
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  // Navbar sempre visibile: nessun listener scroll per evitare re-render e crash durante lo scroll
  const isNavbarVisible = true;
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

  // Rileva dispositivi Android
  useAndroidDetection();

  useEffect(() => {
    // Forza il layout a essere pronto
    const timer = setTimeout(() => {
      setIsLayoutReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, [location]);

  useEffect(() => {
    // Applica stili forzati per garantire che la navbar sia sempre fissa
    const applyNavbarFix = () => {
      const navbar = document.querySelector('.app-navbar');
      if (navbar) {
        const element = navbar as HTMLElement;
        element.style.position = 'sticky';
        element.style.bottom = '0';
        element.style.zIndex = '9999';
        element.style.flexShrink = '0';
        element.style.width = '100%';
        element.style.overflow = 'visible';
      }
    };

    applyNavbarFix();
    
    // Riapplica quando cambia la location
    const timer = setTimeout(applyNavbarFix, 100);
    
    return () => clearTimeout(timer);
  }, [location, shouldShowNavbar]);

  return (
    <div className="robust-app-layout">
      {/* Header area */}
      <header className="app-header">
        {/* Header content se necessario */}
      </header>
      
      {/* Main content area - ErrorBoundary evita che un crash in una pagina faccia cadere l'intera app */}
      <main className="app-main">
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </main>
      
      {/* Navbar area - sempre visibile (nessun hide-on-scroll per evitare crash) */}
      {shouldShowNavbar && (
        <nav 
          className="app-navbar navbar-visible"
          style={{
            position: 'sticky',
            bottom: 0,
            zIndex: 9999,
            flexShrink: 0,
            width: '100%',
            overflow: 'visible',
            transition: 'transform 0.3s ease-in-out'
          }}
        >
          <Navbar />
        </nav>
      )}
    </div>
  );
};
