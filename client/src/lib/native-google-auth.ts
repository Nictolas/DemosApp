import { Capacitor, registerPlugin } from '@capacitor/core';
import { API_CONFIG, getApiUrl } from './api-config';

type NativeGoogleAuthResult = {
  idToken: string;
};

interface NativeGoogleAuthPlugin {
  signIn(options: { serverClientId: string }): Promise<NativeGoogleAuthResult>;
  clearState(): Promise<void>;
}

const NativeGoogleAuth = registerPlugin<NativeGoogleAuthPlugin>('NativeGoogleAuth');

export const isNativeAndroid = (): boolean => {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
};

/**
 * Avvia Credential Manager Android e invia l'ID token risultante al backend DEMOS.
 * Il backend resta l'unico punto che valida firma, issuer e audience del token.
 */
export async function loginWithNativeGoogle(serverClientId: string): Promise<{
  success: boolean;
  message?: string;
  isNew?: boolean;
}> {
  if (!isNativeAndroid()) {
    return { success: false, message: 'Login Google nativo disponibile solo su Android.' };
  }

  const { idToken } = await NativeGoogleAuth.signIn({ serverClientId });
  if (!idToken) {
    return { success: false, message: 'Google non ha restituito un token di accesso.' };
  }

  const response = await fetch(getApiUrl(API_CONFIG.OAUTH.GOOGLE), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data?.success) {
    return {
      success: false,
      message: data?.error || data?.message || 'Accesso con Google non riuscito.',
    };
  }

  const token = data.accessToken || data.token;
  if (token) localStorage.setItem('auth_token', token);
  if (data.refreshToken) localStorage.setItem('refresh_token', data.refreshToken);
  if (data.user?.id) localStorage.setItem('webauthn_user_id', String(data.user.id));

  return {
    success: true,
    message: data.message,
    isNew: data.isNew === true,
  };
}

/** Notifica Credential Manager quando l'utente esegue un logout esplicito. */
export async function clearNativeGoogleCredentialState(): Promise<void> {
  if (!isNativeAndroid()) return;
  await NativeGoogleAuth.clearState();
}
