/**
 * DEMOS: App Open Ad eligibility policy (Android only).
 *
 * This module never connects to an ad network and never reads user identity,
 * vote selections, demographic data or political opinions.
 *
 * The native integration must supply VERIFIED UMP + non-personalization state,
 * a confirmed AdMob app/unit configuration, and the actual loading-screen state.
 * Missing context denies the ad.
 */

export const MIN_APP_OPEN_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const APP_OPEN_ADS_ENABLED_BY_DEFAULT = false;

export interface AppOpenAdContext {
  enabled: boolean;
  privacyGatePassed: boolean;
  nonPersonalizedAdsEnforced: boolean;
  providerApproved: boolean;
  isNativeAndroid: boolean;
  isForeground: boolean;
  isLoadingScreen: boolean;
  isFirstUse: boolean;
  hasSensitiveContentVisible: boolean;
  lastShownAtMs: number | null;
  nowMs: number;
}

/**
 * A request is allowed ONLY while a genuine Android loading screen is visible,
 * never on first use, and only after 6h have elapsed since the LAST displayed ad.
 * Calling code must recheck this policy immediately before displaying an ad.
 *
 * Persist the last display timestamp on onAdShowedFullScreenContent, not on load
 * or request: preloading is not an impression.
 */
export function canRequestAppOpenAd(context: AppOpenAdContext): boolean {
  if (
    context.enabled !== true ||
    context.privacyGatePassed !== true ||
    context.nonPersonalizedAdsEnforced !== true ||
    context.providerApproved !== true ||
    context.isNativeAndroid !== true ||
    context.isForeground !== true ||
    context.isLoadingScreen !== true ||
    context.isFirstUse !== false ||
    context.hasSensitiveContentVisible !== false
  ) {
    return false;
  }

  const now = context.nowMs;
  if (!Number.isFinite(now) || now < 0) return false;

  const previous = context.lastShownAtMs;
  if (previous === null) return true;
  if (!Number.isFinite(previous) || previous < 0) return false;

  // Fail closed if the wall clock moved backward after the last ad.
  const elapsed = now - previous;
  return elapsed >= MIN_APP_OPEN_INTERVAL_MS;
}
