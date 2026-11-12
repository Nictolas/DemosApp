import React, { useLayoutEffect } from 'react';
import { useLocation } from 'wouter';
import { useAndroidDetection } from '@/hooks/useAndroidDetection';
import { useMobileLayout } from '@/hooks/useMobileLayout';
import Navbar from './Navbar';
import { DesktopSidebar } from './DesktopSidebar';
import { DesktopAppHeader } from './DesktopAppHeader';
import { ErrorBoundary } from './ErrorBoundary';

interface RobustAppLayoutProps {
  children: React.ReactNode;
}

const PUBLIC_ROUTES_WITHOUT_NAV = [
  '/',
  '/auth',
  '/scopri-demos',
  '/reset-password',
  '/privacy-policy',
  '/terms-of-service',
  '/cookie-policy',
  '/gdpr',
];

// Android: long, document-like routes must scroll within app-main. Fixed dashboards,
// selection grids and pages with their own scrollport are deliberately excluded.
const ANDROID_SCROLL_ROUTES = new Set([
  '/approfondimento', '/sondaggi', '/statistiche-utenti',
  '/statistiche-opinione', '/legal-documents', '/data-retention', '/gdpr-rights',
  '/security-measures', '/registro-trattamenti', '/accessibilita',
  '/standard-sicurezza-minori', '/cookie-policy', '/terms-of-service',
  '/privacy-policy', '/audit-dashboard', '/violations-dashboard',
  '/security-dashboard', '/backup-dashboard', '/rate-limiting-dashboard',
  '/validation-dashboard', '/logging-dashboard', '/scopri-demos',
]);
function androidPageNeedsScroll(path: string): boolean {
  return ANDROID_SCROLL_ROUTES.has(path)
    || path.startsWith('/sondaggi/')
    || path.startsWith('/statistiche-opinione/')
    || path.startsWith('/monitoring-dashboard/');
}

function shouldShowAppNav(location: string): boolean {
  if (PUBLIC_ROUTES_WITHOUT_NAV.includes(location)) return false;
  if (location.startsWith('/registrazione')) return false;
  if (location.startsWith('/verifica-email')) return false;
  if (location.startsWith('/conferma-email')) return false;
  return true;
}

export const RobustAppLayout: React.FC<RobustAppLayoutProps> = ({ children }) => {
  const [location] = useLocation();
  const isScrollableContentPage = location === '/avvistamenti' || location === '/vota-iniziativa-popolare' || location === '/grazia' || location === '/amnistia' || location === '/capo-stato' || location === '/capo-di-stato' || location === '/iniziative-popolari' || location === '/eci' || location === '/petizioni-parlamentari' || location === '/referendum-abrogativi' || location === '/notifiche/preferenze' || location === '/proponi-opinione' || location === '/governo' || location.startsWith('/governo/');
  const isMobileLayout = useMobileLayout();
  const androidScrollPage = androidPageNeedsScroll(location);
  const showAppNav = shouldShowAppNav(location);
  // Stable route-level marker survives temporary login loaders and auth redirects.
  // Do not include registration: its wizard keeps its own scrollable viewport.
  const isAuthEntryPage = location === '/' || location === '/auth';
  const isStableAuthViewportRoute = isAuthEntryPage ||
    location === '/profilo' || location.startsWith('/profilo/');
  const showMobileNavbar = isMobileLayout && showAppNav;
  // Su PC nessuna sidebar: Preferiti è l'hub. Navbar solo su cellulare.
  const showDesktopSidebar = false;
  const showDesktopHeader = !isMobileLayout && showAppNav;

  useAndroidDetection();

  // Apply the mobile shell classes before paint to avoid a desktop-to-mobile flash.
  useLayoutEffect(() => {
    document.documentElement.classList.toggle('demos-desktop-layout', !isMobileLayout);
    document.documentElement.classList.toggle('demos-mobile-layout', isMobileLayout);
  }, [isMobileLayout]);

  return (
    <div className={`robust-app-layout${showDesktopSidebar ? ' robust-app-layout--desktop' : ''}${isStableAuthViewportRoute ? ' robust-app-layout--stable-auth-profile' : ''}`}>
      {showDesktopSidebar && <DesktopSidebar />}

      <div className="robust-app-layout__content">
        <header className="app-header" aria-hidden="true" />

        {showDesktopHeader && <DesktopAppHeader />}

        <main className={`app-main${location === '/notifiche' ? ' app-main--notifiche' : location === '/notifiche-totali' ? ' app-main--admin-notifiche' : location === '/admin/ops-center' ? ' app-main--admin-ops' : location === '/eventi' ? ' app-main--eventi' : location === '/attivisti' || location === '/organizzazioni' ? ' app-main--directory' : location === '/profilo' || location.startsWith('/profilo/') ? ' app-main--profile' : ''}${isAuthEntryPage ? ' app-main--auth-entry' : ''}${isScrollableContentPage ? ' app-main--scroll-content' : ''}${androidScrollPage ? ' app-main--android-document-scroll' : ''}`}>
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
