/**
 * Android 1.0.11 page-level vertical scroll. Dialogs and list scrollers
 * are independent. Unlisted routes preserve existing behavior.
 */
export type AndroidPageScrollPolicy = 'fixed' | 'scroll' | 'inherit';

const FIXED_PAGES = new Set([
  '/opinioni', '/opinioni-nazionali', '/opinioni-regionali',
  '/opinioni-comunali', '/opinioni-europee', '/rappresentanti',
  '/candidati'
]);
const SCROLL_PAGES = new Set([
  '/approfondimento', '/proponi-opinione', '/sondaggi',
  '/statistiche-utenti', '/statistiche-opinione',
  // Public policies and legal records must always remain readable on Android.
  '/legal-documents', '/data-retention', '/gdpr-rights',
  '/security-measures', '/registro-trattamenti', '/accessibilita',
  '/standard-sicurezza-minori', '/cookie-policy',
  '/terms-of-service', '/privacy-policy'
]);

export function getAndroidPageScrollPolicy(url: string): AndroidPageScrollPolicy {
  const pathname = (url.split(/[?#]/, 1)[0].replace(/\/+$/, '') || '/');
  if (FIXED_PAGES.has(pathname)) return 'fixed';
  if (/^\/(?:scegli-rappresentante|candidati)\/[^/]+$/.test(pathname)) return 'fixed';
  if (SCROLL_PAGES.has(pathname)) return 'scroll';
  if (/^\/sondaggi(?:\/[^/]+){1,3}$/.test(pathname)) return 'scroll';
  if (/^\/statistiche-opinione\/[^/]+(?:\/regione\/[^/]+)?$/.test(pathname)) return 'scroll';
  return 'inherit';
}
