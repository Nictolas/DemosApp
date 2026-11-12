import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeAppOpenPrivacyPlugin {
  getStatus(): Promise<{ required: boolean }>;
  showPrivacyOptions(): Promise<void>;
  setAdultEligibility(options: { eligible: boolean }): Promise<void>;
}

const NativeAppOpenPrivacy = registerPlugin<NativeAppOpenPrivacyPlugin>('NativeAppOpenPrivacy');

function isAndroidApp(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

/**
 * Does not pass identity, birth year, political opinions or any targeting
 * data to the Android SDK. Return false on web and on any native failure.
 * The Android release variant implements the bridge with a no-op manager.
 */
export async function areAppOpenPrivacyOptionsRequired(): Promise<boolean> {
  if (!isAndroidApp()) return false;
  try {
    const result = await NativeAppOpenPrivacy.getStatus();
    return result?.required === true;
  } catch {
    return false;
  }
}

export async function showAppOpenPrivacyOptions(): Promise<void> {
  if (!isAndroidApp()) throw new Error('Opzioni pubblicitarie disponibili solo su Android.');
  await NativeAppOpenPrivacy.showPrivacyOptions();
}

/**
 * Never pass birth year or account ID to the native advertising bridge.
 * The backend first derives an age eligibility boolean from its existing
 * authenticated user record; only an explicitly VERIFIED adult is true.
 * Defaults to false for logged-out, unverified and minor users.
 */
export async function setNativeAppOpenAdultEligibility(eligible: boolean): Promise<void> {
  if (!isAndroidApp()) return;
  try {
    await NativeAppOpenPrivacy.setAdultEligibility({ eligible: eligible === true });
  } catch {
    // Fail closed: native manager remains ineligible unless the call succeeds.
  }
}
