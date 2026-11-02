import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativeAppOpenPrivacyPlugin {
  getStatus(): Promise<{ required: boolean }>;
  showPrivacyOptions(): Promise<void>;
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
