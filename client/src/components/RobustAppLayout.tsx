import React, { useEffect, useState } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth-neon';
import { DeviceSpecificProvider } from './DeviceSpecificProvider';
import Navbar from './Navbar';

interface RobustAppLayoutProps {
  children: React.ReactNode;
}

export const RobustAppLayout: React.FC<RobustAppLayoutProps> = ({ children }) => {
  const [location] = useLocation();
  const { user } = useAuth();
  const [isLayoutReady, setIsLayoutReady] = useState(false);

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
    <DeviceSpecificProvider>
      <div className="modern-app-layout">
        {/* Header area */}
        <header className="app-header">
          {/* Header content se necessario */}
        </header>
        
        {/* Main content area */}
        <main className="app-main">
          {children}
        </main>
        
        {/* Navbar area - SEMPRE FISSA */}
        {shouldShowNavbar && (
          <nav className="app-navbar">
            <Navbar />
          </nav>
        )}
      </div>
    </DeviceSpecificProvider>
  );
};
