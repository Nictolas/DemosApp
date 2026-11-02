/**
 * DEMOS advertising policy. Pure, fail-closed eligibility checks.
 *
 * This file does NOT fetch ads or read the citizen profile. CMP/UMP approval,
 * network eligibility, and the current loading state must be supplied by the
 * integration itself. No ad provider is imported here.
 */
export type AdPlacement = 'web_banner' | 'android_app_open';

export interface AdvertisingContext {
  placement: AdPlacement;
  pathname: string;
  enabled: boolean;
  privacyGatePassed: boolean;
  providerApproved: boolean;
  isNativeApp: boolean;
  isLoadingScreen?: boolean;
  isFirstUse?: boolean;
  lastShownAtMs?: number | null;
  nowMs?: number;
}

export const MIN_APP_OPEN_INTERVAL_MS = 24 * 60 * 60 * 1000;

const WEB_BANNER_ALLOWLIST = new Set(['/scopri-demos']);

function normalizedPath(pathname: string): string {
  const onlyPath = pathname.split(/[?#]/, 1)[0];
  const trimmed = onlyPath.replace(/\/+$/, '');
  return trimmed || '/';
}

/**
 * No ads until all external privacy/provider gates are verified.
 * For web banners, only the public informational page is allowed initially.
 * App Open is allowed only on the native loading screen (never over content)
 * and never on first use or more than once in a rolling 24-hour window.
 */
export function canRequestCommercialAd(context: AdvertisingContext): boolean {
  if (!context.enabled || !context.privacyGatePassed || !context.providerApproved) {
    return false;
  }

  const pathname = normalizedPath(context.pathname);

  if (context.placement === 'web_banner') {
    return !context.isNativeApp && WEB_BANNER_ALLOWLIST.has(pathname);
  }

  if (context.placement !== 'android_app_open') return false;
  if (!context.isNativeApp || !context.isLoadingScreen || context.isFirstUse !== false) {
    return false;
  }

  // The loading screen is the only permitted App Open placement.
  if (pathname !== '/') return false;

  const nowMs = context.nowMs;
  if (typeof nowMs !== 'number' || !Number.isFinite(nowMs)) return false;

  if (context.lastShownAtMs != null) {
    if (!Number.isFinite(context.lastShownAtMs)) return false;
    const elapsed = nowMs - context.lastShownAtMs;
    if (elapsed < MIN_APP_OPEN_INTERVAL_MS) return false;
  }

  return true;
}
