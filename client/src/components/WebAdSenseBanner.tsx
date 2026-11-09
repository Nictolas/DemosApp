import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import {
  canRequestWebAdSenseBanner,
  classifyWebAdSurface,
  WEB_ADS_ENABLED_BY_DEFAULT,
} from '@/lib/web-advertising-policy';

/**
 * The certified web CMP must provide this synchronous, session-current bridge
 * AFTER it has confirmed the user's advertising choice. This bridge is NOT
 * installed in DEMOS yet: the absence of it always denies ad requests.
 * The CMP must emit "demos:web-ad-consent-changed" on revocation/change.
 */
declare global {
  interface Window {
    __demosWebAdsConsentBridge?: {
      canServeNonPersonalizedAds(): boolean;
    };
    adsbygoogle?: Array<Record<string, never>> & { requestNonPersonalizedAds?: number };
  }
}

const clientId = import.meta.env.VITE_DEMOS_ADSENSE_CLIENT_ID || '';
const adSlot = import.meta.env.VITE_DEMOS_ADSENSE_BANNER_SLOT || '';

function approvedForManualBanner(): boolean {
  if (typeof window === 'undefined') return false;
  const environment = {
    native: Capacitor.isNativePlatform(),
    standaloneDisplayMode: window.matchMedia?.('(display-mode: standalone)').matches === true,
    standaloneIos: (window.navigator as Navigator & { standalone?: boolean }).standalone === true,
    desktopViewport: window.matchMedia?.('(min-width: 900px)').matches === true,
  };
  if (classifyWebAdSurface(environment) === 'installed-pwa') return false;

  let cmpConsent = false;
  try {
    cmpConsent = window.__demosWebAdsConsentBridge?.canServeNonPersonalizedAds() === true;
  } catch {
    return false;
  }

  return canRequestWebAdSenseBanner({
    ...environment,
    enabled: import.meta.env.VITE_DEMOS_WEB_ADS_ENABLED === 'true' &&
      WEB_ADS_ENABLED_BY_DEFAULT === false,
    siteApproved: import.meta.env.VITE_DEMOS_ADSENSE_SITE_APPROVED === 'true',
    cmpCertified: import.meta.env.VITE_DEMOS_WEB_ADS_CMP_CERTIFIED === 'true',
    liveCmpDecisionAllowsAds: cmpConsent,
    nonPersonalizedAdsOnly: import.meta.env.VITE_DEMOS_WEB_ADS_NONPERSONALIZED_ONLY === 'true' &&
      // Manual banners only: disabling global Auto ads on this site prevents
      // a loaded script from displaying vignettes over later SPA routes.
      import.meta.env.VITE_DEMOS_WEB_ADS_AUTO_ADS_DISABLED === 'true',
    pathname: window.location.pathname,
    clientId,
    adSlot,
  });
}

/**
 * Real Google manual banner integration, but strictly fail-closed:
 * 1. Disabled by default in every Vite build, including Android AAB;
 * 2. Requires explicit deploy flags, approved domain, configured ad unit;
 * 3. Requires a currently-valid *verified CMP adapter*, not present yet;
 * 4. Public /scopri-demos only; never shows in installed PWA or native app.
 *
 * This component is not the fullscreen PWA format. Google AdSense vignette
 * loading is intentionally NOT implemented because its document-wide triggers
 * could interrupt political forms elsewhere in this single-page app.
 */
export function WebAdSenseBanner() {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (Capacitor.isNativePlatform()) return;

    const refresh = () => {
      const next = approvedForManualBanner();
      setAllowed(next);
      // An injected Google script cannot be reliably unloaded. Consent
      // withdrawal therefore starts a fresh document without ad scripts.
      if (!next && document.querySelector('script[data-demos-manual-adsense="true"]')) {
        window.location.reload();
      }
    };
    refresh();
    window.addEventListener('demos:web-ad-consent-changed', refresh);
    window.addEventListener('focus', refresh);
    return () => {
      window.removeEventListener('demos:web-ad-consent-changed', refresh);
      window.removeEventListener('focus', refresh);
    };
  }, []);

  useEffect(() => {
    if (!allowed) return;
    let active = true;
    // Google defaults to personalized ads unless explicitly configured. Set
    // NPA=1 before loading the script and before every ad-slot request.
    const queue = window.adsbygoogle = window.adsbygoogle || [];
    queue.requestNonPersonalizedAds = 1;
    const injectAd = () => {
      if (!active || !approvedForManualBanner()) return;
      try {
        const requestQueue = window.adsbygoogle = window.adsbygoogle || [];
        requestQueue.requestNonPersonalizedAds = 1;
        requestQueue.push({});
      } catch {
        // An ad may be blocked by the browser, provider or ad inventory.
        // The app remains usable; no retry loop or forced loading screen.
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[data-demos-manual-adsense="true"]',
    );
    if (existing) {
      if (existing.dataset.demosLoaded === 'true') injectAd();
      else existing.addEventListener('load', injectAd, { once: true });
      return () => {
        active = false;
        existing.removeEventListener('load', injectAd);
      };
    }

    const script = document.createElement('script');
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.dataset.demosManualAdsense = 'true';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=' + clientId;
    const onLoad = () => {
      script.dataset.demosLoaded = 'true';
      injectAd();
    };
    script.addEventListener('load', onLoad, { once: true });
    document.head.appendChild(script);

    return () => {
      active = false;
      script.removeEventListener('load', onLoad);
    };
  }, [allowed]);

  if (!allowed) return null;
  return (
    <aside className="my-6 rounded-lg border border-slate-200 bg-white p-3" aria-label="Pubblicità">
      <p className="mb-2 text-center text-xs text-slate-500">Pubblicità</p>
      <ins
        className="adsbygoogle"
        style={{ display: 'block', minHeight: 96 }}
        data-ad-client={clientId}
        data-ad-slot={adSlot}
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </aside>
  );
}
