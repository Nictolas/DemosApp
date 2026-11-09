/**
 * Web/PWA ad decisions are deliberately separate from native Android AdMob.
 * No political data, account identity, geolocation or age profile is read.
 * All ad-network loading is DENIED by default.
 */
export const WEB_ADS_ENABLED_BY_DEFAULT = false;
export const WEB_ADSENSE_ALLOWED_PUBLIC_ROUTES = ['/scopri-demos'] as const;

export type WebAdSurface =
  | 'native-app'
  | 'installed-pwa'
  | 'desktop-browser'
  | 'mobile-browser';

export interface WebAdEnvironment {
  native: boolean;
  standaloneDisplayMode: boolean;
  standaloneIos: boolean;
  desktopViewport: boolean;
}

export interface WebAdSenseGate extends WebAdEnvironment {
  enabled: boolean;
  siteApproved: boolean;
  cmpCertified: boolean;
  liveCmpDecisionAllowsAds: boolean;
  nonPersonalizedAdsOnly: boolean;
  pathname: string;
  clientId: string;
  adSlot: string;
}

/**
 * Treat iOS Safari's navigator.standalone and CSS standalone display mode
 * equivalently. Native Capacitor takes precedence even if the viewport matches.
 */
export function classifyWebAdSurface(context: WebAdEnvironment): WebAdSurface {
  if (context.native === true) return 'native-app';
  if (context.standaloneDisplayMode === true || context.standaloneIos === true) {
    return 'installed-pwa';
  }
  return context.desktopViewport === true ? 'desktop-browser' : 'mobile-browser';
}

function commonProviderGate(context: WebAdSenseGate): boolean {
  if (
    context.enabled !== true ||
    context.siteApproved !== true ||
    context.cmpCertified !== true ||
    context.liveCmpDecisionAllowsAds !== true ||
    context.nonPersonalizedAdsOnly !== true ||
    !WEB_ADSENSE_ALLOWED_PUBLIC_ROUTES.includes(
      context.pathname as (typeof WEB_ADSENSE_ALLOWED_PUBLIC_ROUTES)[number],
    ) ||
    !/^ca-pub-\d{16}$/.test(context.clientId) ||
    !/^\d{10}$/.test(context.adSlot)
  ) {
    return false;
  }
  return true;
}

/**
 * Manual in-content AdSense banners are permitted only in public informational
 * pages, never in native Android, installed PWA, civic forms, vote or sign views.
 * The only public allowlisted route is /scopri-demos.
 */
export function canRequestWebAdSenseBanner(context: WebAdSenseGate): boolean {
  if (!commonProviderGate(context)) return false;
  const surface = classifyWebAdSurface(context);
  return surface === 'desktop-browser' || surface === 'mobile-browser';
}

/**
 * This is a *planning gate*, not an ad load or a guarantee that Google will
 * show a vignette. Auto ads run at document level and may outlive SPA route
 * changes, so no vignette SDK is injected by DEMOS pending a verified method
 * of excluding civic-sensitive pages and confirming Google account settings.
 */
export function couldEnablePwaVignetteAfterReview(context: WebAdSenseGate): boolean {
  return commonProviderGate(context) &&
    classifyWebAdSurface(context) === 'installed-pwa';
}
