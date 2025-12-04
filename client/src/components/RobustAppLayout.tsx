import React, { useEffect, useState, useRef } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/use-auth-neon';
import { useAndroidDetection } from '@/hooks/useAndroidDetection';
import Navbar from './Navbar';

interface RobustAppLayoutProps {
  children: React.ReactNode;
}

export const RobustAppLayout: React.FC<RobustAppLayoutProps> = ({ children }) => {
  const [location] = useLocation();
  const { user } = useAuth();
  const [isLayoutReady, setIsLayoutReady] = useState(false);
  const [isNavbarVisible, setIsNavbarVisible] = useState(true);
  const lastScrollYRef = useRef(0);
  
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
  useEffect(() => {
    if (!shouldShowNavbar) {
      setIsNavbarVisible(true);
      return;
    }

    let ticking = false;

    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const mainContent = document.querySelector('.app-main');
          if (!mainContent) {
            ticking = false;
            return;
          }

          const currentScrollY = mainContent.scrollTop;
          const scrollThreshold = 10; // Soglia minima per evitare flickering

          // In cima = mostra sempre la navbar
          if (currentScrollY <= scrollThreshold) {
            setIsNavbarVisible(true);
          }
          // Scorrere verso il basso = mostra navbar
          else if (currentScrollY > lastScrollYRef.current) {
            setIsNavbarVisible(true);
          }
          // Scorrere verso l'alto = nascondi navbar
          else if (currentScrollY < lastScrollYRef.current) {
            setIsNavbarVisible(false);
          }

          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    const mainContent = document.querySelector('.app-main');
    if (mainContent) {
      // Inizializza la posizione
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
      
      {/* Main content area */}
      <main className="app-main">
        {children}
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
