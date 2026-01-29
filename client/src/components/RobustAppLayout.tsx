import React, { useEffect, useState, useRef } from 'react';
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
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  const lastNavbarVisibleRef = useRef(true);
  const isMountedRef = useRef(true);
  const rafIdRef = useRef<number | null>(null);
  
  // Rileva dispositivi Android
  useAndroidDetection();

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

  // Gestione scroll per mostrare/nascondere navbar
  // CRITICO: setState solo quando la visibilità cambia + nessun setState dopo unmount,
  // per evitare re-render a ogni frame e crash "setState on unmounted component"
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!shouldShowNavbar) {
      setIsNavbarVisible(true);
      lastNavbarVisibleRef.current = true;
      return;
    }

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        ticking = true;
        rafIdRef.current = requestAnimationFrame(() => {
          rafIdRef.current = null;
          ticking = false;
          if (!isMountedRef.current) return;

          const mainContent = document.querySelector('.app-main');
          if (!mainContent) return;

          const currentScrollY = mainContent.scrollTop;
          const scrollThreshold = 10;

          let nextVisible: boolean;
          if (currentScrollY <= scrollThreshold) {
            nextVisible = true;
          } else if (currentScrollY > lastScrollYRef.current) {
            nextVisible = true;
          } else if (currentScrollY < lastScrollYRef.current) {
            nextVisible = false;
          } else {
            lastScrollYRef.current = currentScrollY;
            return;
          }

          lastScrollYRef.current = currentScrollY;
          if (nextVisible !== lastNavbarVisibleRef.current && isMountedRef.current) {
            lastNavbarVisibleRef.current = nextVisible;
            setIsNavbarVisible(nextVisible);
          }
        });
      }
    };

    const mainContent = document.querySelector('.app-main');
    if (mainContent) {
      lastScrollYRef.current = mainContent.scrollTop;
      mainContent.addEventListener('scroll', handleScroll, { passive: true });
      return () => {
        mainContent.removeEventListener('scroll', handleScroll);
      };
    }
  }, [shouldShowNavbar]);

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
      
      {/* Navbar area - Appare/Scompare con scroll */}
      {shouldShowNavbar && (
        <nav 
          className={`app-navbar ${isNavbarVisible ? 'navbar-visible' : 'navbar-hidden'}`}
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
