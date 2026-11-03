import { requestNativeFirebaseAppCheckToken } from './nativeFirebaseAppCheck';

export type AppCheckDiagnosticStatus =
  | 'disabled' | 'unavailable' | 'unauthorized' | 'error'
  | 'verified' | 'invalid' | 'missing' | 'malformed'
  | 'different_app' | 'limited' | 'unconfigured';

// Tokens can only go to an existing, approved DEMOS endpoint.
const ALLOWED_API_HOSTS = new Set([
  'demos.community',
  'www.demos.community',
  'demos-c7k0.onrender.com',
]);

/**
 * Manual-only, Admin-authenticated diagnostic transport. NOT called by
 * startup, login, opinions, votes, notifications, or any other app workflow.
 * The independent Vite, native BuildConfig, and backend gates are OFF.
 */
export async function runManualNativeAppCheckDiagnostic(
  apiOrigin: string,
  accessToken: string,
): Promise<AppCheckDiagnosticStatus> {
  if (import.meta.env.VITE_FIREBASE_APP_CHECK_DIAGNOSTIC_ENABLED !== 'true') {
    return 'disabled';
  }
  if (typeof accessToken !== 'string' || accessToken.length < 16) {
    return 'unauthorized';
  }
  let endpoint: URL;
  try {
    const base = new URL(apiOrigin);
    if (base.protocol !== 'https:' || !ALLOWED_API_HOSTS.has(base.hostname)
        || base.username || base.password || base.search || base.hash) {
      return 'unavailable';
    }
    endpoint = new URL('/api/admin/firebase-app-check/observe', base.origin);
  } catch {
    return 'unavailable';
  }

  const token = await requestNativeFirebaseAppCheckToken();
  if (!token) return 'unavailable';
  try {
    const response = await fetch(endpoint.href, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'X-Firebase-AppCheck': token,
      },
      cache: 'no-store',
      redirect: 'error',
    });
    if (response.status === 401 || response.status === 403) return 'unauthorized';
    if (!response.ok) return 'error';
    const data: unknown = await response.json();
    const status = typeof data === 'object' && data !== null && 'status' in data
      ? (data as { status?: unknown }).status : null;
    switch (status) {
      case 'verified':
      case 'invalid':
      case 'missing':
      case 'malformed':
      case 'different_app':
      case 'limited':
      case 'unconfigured':
      case 'disabled':
        return status;
      default:
        return 'error';
    }
  } catch {
    // Never log or forward raw tokens, authorization, user IDs or network errors.
    return 'error';
  }
}
