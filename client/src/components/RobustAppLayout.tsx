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

  return (
    <div className={`robust-app-layout ${showDesktopSidebar ? 'robust-app-layout--desktop' : ''}`}>
      {showDesktopSidebar && <DesktopSidebar />}

      <div className="robust-app-layout__content">
        <header className="app-header" aria-hidden="true" />

        <main className="app-main">
          <ErrorBoundary>
            <div className="app-main__inner">{children}</div>
          </ErrorBoundary>
        </main>

        {showMobileNavbar && (
          <nav className="app-navbar navbar-visible" aria-label="Navigazione principale">
            <Navbar />
          </nav>
        )}
      </div>
    </div>
  );
};
