import React, { useEffect } from 'react';
import { useLocation } from 'wouter';
import { useAndroidDetection } from '@/hooks/useAndroidDetection';
import { useMobileLayout } from '@/hooks/useMobileLayout';
import Navbar from './Navbar';
import { DesktopSidebar } from './DesktopSidebar';
import { ErrorBoundary } from './ErrorBoundary';

interface RobustAppLayoutProps {
  children: React.ReactNode;
}

const PUBLIC_ROUTES_WITHOUT_NAV = [
  '/',
  '/auth',
  '/reset-password',
  '/privacy-policy',
  '/terms-of-service',
  '/cookie-policy',
  '/gdpr',
];

function shouldShowAppNav(location: string): boolean {
  if (PUBLIC_ROUTES_WITHOUT_NAV.includes(location)) return false;
  if (location.startsWith('/registrazione')) return false;
  if (location.startsWith('/verifica-email')) return false;
  if (location.startsWith('/conferma-email')) return false;
  return true;
}

export const RobustAppLayout: React.FC<RobustAppLayoutProps> = ({ children }) => {
  const [location] = useLocation();
  const isMobileLayout = useMobileLayout();
  const showAppNav = shouldShowAppNav(location);
  const showMobileNavbar = isMobileLayout && showAppNav;
  const showDesktopSidebar = !isMobileLayout && showAppNav;

  useAndroidDetection();

  useEffect(() => {
    document.documentElement.classList.toggle('demos-desktop-layout', !isMobileLayout);
    document.documentElement.classList.toggle('demos-mobile-layout', isMobileLayout);
  }, [isMobileLayout]);

  useEffect(() => {
    if (!showMobileNavbar) return;

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
    const timer = setTimeout(applyNavbarFix, 100);

    return () => clearTimeout(timer);
  }, [location, showMobileNavbar]);

  return (
    <div className={`robust-app-layout ${showDesktopSidebar ? 'robust-app-layout--desktop' : ''}`}>
      {showDesktopSidebar && <DesktopSidebar />}

      <div className="robust-app-layout__content">
        <header className="app-header" />

        <main className="app-main">
          <ErrorBoundary>
            {children}
          </ErrorBoundary>
        </main>

        {showMobileNavbar && (
          <nav
            className="app-navbar navbar-visible"
            style={{
              position: 'sticky',
              bottom: 0,
              zIndex: 9999,
              flexShrink: 0,
              width: '100%',
              overflow: 'visible',
              transition: 'transform 0.3s ease-in-out',
            }}
          >
            <Navbar />
          </nav>
        )}
      </div>
    </div>
  );
};
