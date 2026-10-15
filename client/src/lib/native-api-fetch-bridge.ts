import { Capacitor } from '@capacitor/core';
import { getApiUrl } from './api-config';

let installed = false;

const isRelativeApiPath = (value: string): boolean => {
  return value === '/api' || value.startsWith('/api/') || value.startsWith('/api?');
};

/**
 * Capacitor carica il bundle da un'origine WebView locale. Il codice storico
 * contiene ancora alcuni `fetch('/api/...')`: sul web sono corretti, mentre in
 * una build nativa finirebbero sull'origine locale dell'app anziché sul backend.
 *
 * Questo bridge è intenzionalmente ristretto a URL stringa/URL relativi sotto
 * `/api`; non modifica richieste assolute né asset locali e non opera sul web.
 */
export function installNativeApiFetchBridge(): void {
  if (installed || typeof window === 'undefined' || !Capacitor.isNativePlatform()) return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === 'string' && isRelativeApiPath(input)) {
      return originalFetch(getApiUrl(input), init);
    }

    if (input instanceof URL && input.origin === window.location.origin && isRelativeApiPath(`${input.pathname}${input.search}`)) {
      return originalFetch(getApiUrl(`${input.pathname}${input.search}`), init);
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;

  installed = true;
}
