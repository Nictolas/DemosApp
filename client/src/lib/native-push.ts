import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

const PUSH_TOKEN_STORAGE_KEY = 'demos_native_push_token';

export function isNativePushRuntime(): boolean {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}

export function isNativePushEnabled(): boolean {
  return isNativePushRuntime() && import.meta.env.VITE_ANDROID_NATIVE_PUSH_ENABLED === 'true';
}

export function getStoredNativePushToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(PUSH_TOKEN_STORAGE_KEY);
}

export function storeNativePushToken(token: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredNativePushToken(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY);
}

export async function unregisterNativePush(): Promise<void> {
  if (!isNativePushEnabled()) return;
  try {
    await PushNotifications.unregister();
  } catch (error) {
    console.warn('Impossibile annullare la registrazione push nativa:', error);
  }
}
