import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeFirebaseAppCheckBridge {
  getStatus(): Promise<{ enabled: boolean; platform: string }>;
  requestToken(): Promise<{ token: string }>;
}

const bridge = registerPlugin<NativeFirebaseAppCheckBridge>('NativeFirebaseAppCheck');

/**
 * Optional Android-only App Check integration for a future, reviewed rollout.
 * Two independent gates MUST be enabled explicitly: Vite and Android BuildConfig.
 * No token is requested on import, login, opening the app, or voting.
 */
export async function requestNativeFirebaseAppCheckToken(): Promise<string | null> {
  if (import.meta.env.VITE_FIREBASE_APP_CHECK_ENABLED !== 'true') return null;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return null;
  try {
    const status = await bridge.getStatus();
    if (!status.enabled) return null;
    const result = await bridge.requestToken();
    return typeof result.token === 'string' && result.token.length > 0 ? result.token : null;
  } catch {
    // Fail open ONLY for attestation. Existing authorization remains unchanged.
    return null;
  }
}
