import { Capacitor, registerPlugin } from '@capacitor/core';
import { createPlayIntegrityRequestHash } from './playIntegrityHash';

interface NativePlayIntegrityBridge {
  getStatus(): Promise<{ enabled: boolean; platform: string }>;
  prepareToken(): Promise<{ ready: boolean }>;
  requestToken(options: { requestHash: string }): Promise<{ token: string }>;
}

const nativeBridge = registerPlugin<NativePlayIntegrityBridge>('NativePlayIntegrity');
let tokenProviderReady: Promise<boolean> | null = null;

/**
 * Deliberately disabled for current DEMOS builds. This is an OPTIONAL helper,
 * not wired into login, opinions, navigation, or other application flows.
 * Both frontend and native BuildConfig gates must be changed in a future,
 * independently approved no-cost rollout before any Google API call is made.
 */
export async function isNativePlayIntegrityEnabled(): Promise<boolean> {
  if (import.meta.env.VITE_PLAY_INTEGRITY_ENABLED !== 'true') return false;
  if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== 'android') return false;
  try {
    return (await nativeBridge.getStatus()).enabled === true;
  } catch {
    return false;
  }
}

export async function requestPlayIntegrityToken(
  action: string, payload: unknown
): Promise<string | null> {
  if (!(await isNativePlayIntegrityEnabled())) return null;
  try {
    if (!tokenProviderReady) {
      tokenProviderReady = nativeBridge.prepareToken().then(r => r.ready === true).catch(() => false);
    }
    if (!(await tokenProviderReady)) {
      tokenProviderReady = null;
      return null;
    }
    const requestHash = await createPlayIntegrityRequestHash(action, payload);
    const result = await nativeBridge.requestToken({ requestHash });
    return typeof result.token === 'string' && result.token.length > 0 ? result.token : null;
  } catch {
    tokenProviderReady = null;
    return null;
  }
}
