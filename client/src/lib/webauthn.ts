import { API_CONFIG, getApiUrl } from './api-config';

type WebAuthnRegisterResult = {
  success: boolean;
  message?: string;
  code?: string;
};

type WebAuthnLoginResult = {
  success: boolean;
  message?: string;
  code?: string;
};

export const isWebAuthnSupported = (): boolean => {
  if (typeof window === 'undefined') return false;
  return 'PublicKeyCredential' in window;
};

const DEVICE_ID_KEY = 'demos_device_id';
const PASSKEY_FLAG_KEY = 'demos_has_passkey';

function setHasPasskeyFlag(value: boolean) {
  try {
    if (value) localStorage.setItem(PASSKEY_FLAG_KEY, 'true');
    else localStorage.removeItem(PASSKEY_FLAG_KEY);
  } catch (_) {}
}

export function hasLocalPasskeyFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(PASSKEY_FLAG_KEY) === 'true';
  } catch {
    return false;
  }
}

/** ID dispositivo per limite "un account passkey per dispositivo" (persistente in localStorage). */
export function getOrCreateDeviceId(): string {
  if (typeof window === 'undefined') return '';
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id || id.length < 10) {
    id = crypto.randomUUID ? crypto.randomUUID() : `dev_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
    try {
      localStorage.setItem(DEVICE_ID_KEY, id);
    } catch (_) {}
  }
  return id;
}

// Helpers per convertire base64url <-> ArrayBuffer (accetta stringa o array di byte)
function base64urlToBuffer(input: string | number[] | Uint8Array | ArrayBuffer): ArrayBuffer {
  if (input == null) throw new Error('Valore mancante per la conversione base64url');
  // Se è già un ArrayBuffer
  if (input instanceof ArrayBuffer) return input;
  // Se è Uint8Array o array di numeri (es. serializzato dal server)
  if (Array.isArray(input) || input instanceof Uint8Array) {
    const arr = Array.isArray(input) ? new Uint8Array(input) : input;
    return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength);
  }
  const base64url = String(input);
  // Normalizza padding e caratteri URL-safe
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = base64.length % 4;
  if (pad === 2) base64 += '==';
  else if (pad === 3) base64 += '=';
  else if (pad !== 0) throw new Error('Stringa base64url non valida');

  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

function bufferToBase64url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function prepareCreationOptionsFromServer(optionsFromServer: any): PublicKeyCredentialCreationOptions {
  const { challenge, user, excludeCredentials, ...rest } = optionsFromServer;
  if (challenge == null || user?.id == null) {
    throw new Error('Opzioni di registrazione incomplete (challenge o user.id mancanti)');
  }

  const publicKey: PublicKeyCredentialCreationOptions = {
    ...rest,
    challenge: base64urlToBuffer(challenge),
    user: {
      ...user,
      id: base64urlToBuffer(user.id),
    },
    excludeCredentials: (excludeCredentials || []).map((cred: any) => ({
      ...cred,
      id: base64urlToBuffer(cred.id ?? cred),
    })),
  };

  return publicKey;
}

function prepareRequestOptionsFromServer(optionsFromServer: any): PublicKeyCredentialRequestOptions {
  const { challenge, allowCredentials, ...rest } = optionsFromServer;
  if (challenge == null) throw new Error('Opzioni di login incomplete (challenge mancante)');

  const publicKey: PublicKeyCredentialRequestOptions = {
    ...rest,
    challenge: base64urlToBuffer(challenge),
    allowCredentials: (allowCredentials || []).map((cred: any) => ({
      ...cred,
      id: base64urlToBuffer(cred.id ?? cred),
    })),
  };

  return publicKey;
}

export async function registerWithPasskey(ruolo: string = 'E'): Promise<WebAuthnRegisterResult> {
  if (!isWebAuthnSupported()) {
    return { success: false, message: 'Passkey/WebAuthn non supportato su questo dispositivo o browser.' };
  }

  try {
    const deviceId = getOrCreateDeviceId();
    const optionsRes = await fetch(getApiUrl(API_CONFIG.WEBAUTHN.REGISTER_OPTIONS), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ruolo, deviceId }),
    });

    const optionsJson = await optionsRes.json();
    if (!optionsRes.ok || !optionsJson.success) {
      const msg = optionsJson.message || optionsJson.error || 'Errore nel richiedere le opzioni per la passkey.';
      return {
        success: false,
        message: msg,
        code: optionsJson.code,
      };
    }

    const { userId, publicKey: publicKeyFromServer } = optionsJson;

    // 2) Prepara le opzioni per WebAuthn (Safari incluso)
    const publicKey = prepareCreationOptionsFromServer(publicKeyFromServer);

    // 3) Avvia la registrazione WebAuthn nel browser
    const credential = (await navigator.credentials.create({
      publicKey,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return {
        success: false,
        message: 'Registrazione annullata o non riuscita.',
      };
    }

    const attestationResponse = credential.response as AuthenticatorAttestationResponse;

    const attestation = {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bufferToBase64url(attestationResponse.clientDataJSON),
        attestationObject: bufferToBase64url(attestationResponse.attestationObject),
      },
    };

    const verifyRes = await fetch(getApiUrl(API_CONFIG.WEBAUTHN.REGISTER_VERIFY), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, attestation, deviceId }),
    });

    const verifyJson = await verifyRes.json();
    if (!verifyRes.ok || !verifyJson.success) {
      return {
        success: false,
        message: verifyJson.message || verifyJson.error || 'Registrazione con passkey non riuscita.',
        code: verifyJson.code,
      };
    }

    // Salva token e userId per i login futuri
    const token = verifyJson.accessToken || verifyJson.token;
    if (token) {
      localStorage.setItem('auth_token', token);
    }
    if (verifyJson.refreshToken) {
      localStorage.setItem('refresh_token', verifyJson.refreshToken);
    }
    if (verifyJson.user?.id) {
      localStorage.setItem('webauthn_user_id', verifyJson.user.id.toString());
    }

    setHasPasskeyFlag(true);

    // Dopo la registrazione, il flusso standard di autenticazione userà il token
    return { success: true, message: 'Registrazione con passkey completata.' };
  } catch (error: any) {
    console.error('❌ Errore durante registerWithPasskey:', error);
    return {
      success: false,
      message: error?.message || 'Errore imprevisto durante la registrazione con passkey.',
    };
  }
}

export async function loginWithPasskey(): Promise<WebAuthnLoginResult> {
  if (!isWebAuthnSupported()) {
    return { success: false, message: 'Passkey/WebAuthn non supportato su questo dispositivo o browser.' };
  }

  try {
    // 1) Discovery: options SENZA userId → allowCredentials vuoto → il browser mostra passkey del dispositivo (Face ID su iPhone)
    const optionsRes = await fetch(getApiUrl(API_CONFIG.WEBAUTHN.LOGIN_OPTIONS), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const optionsJson = await optionsRes.json();
    if (!optionsRes.ok || !optionsJson.success) {
      return {
        success: false,
        message: optionsJson.error || optionsJson.message || 'Errore nel richiedere le opzioni di login con passkey.',
      };
    }

    const { publicKey: publicKeyFromServer, sessionKey } = optionsJson;

    // 2) Prepara le opzioni per WebAuthn
    const publicKey = prepareRequestOptionsFromServer(publicKeyFromServer);

    // 3) Avvia l'autenticazione WebAuthn (discovery + mediation: Face ID / impronta)
    const credential = (await navigator.credentials.get({
      mediation: 'required',
      publicKey,
    })) as PublicKeyCredential | null;

    if (!credential) {
      return {
        success: false,
        message: 'Login annullato o non riuscito.',
      };
    }

    const assertionResponse = credential.response as AuthenticatorAssertionResponse;

    const assertion = {
      id: credential.id,
      rawId: bufferToBase64url(credential.rawId),
      type: credential.type,
      response: {
        clientDataJSON: bufferToBase64url(assertionResponse.clientDataJSON),
        authenticatorData: bufferToBase64url(assertionResponse.authenticatorData),
        signature: bufferToBase64url(assertionResponse.signature),
        userHandle: assertionResponse.userHandle
          ? bufferToBase64url(assertionResponse.userHandle)
          : null,
      },
    };

    // 4) Verifica con sessionKey (il server risale all'utente dal credential id)
    const verifyRes = await fetch(getApiUrl(API_CONFIG.WEBAUTHN.LOGIN_VERIFY), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionKey, assertion }),
    });

    const verifyJson = await verifyRes.json();
    if (!verifyRes.ok || !verifyJson.success) {
      let message = verifyJson.error || verifyJson.message || 'Login con passkey non riuscito.';
      if (verifyJson.hint) message += ' ' + verifyJson.hint;
      return { success: false, message, code: verifyJson.code };
    }

    const token = verifyJson.accessToken || verifyJson.token;
    if (token) {
      localStorage.setItem('auth_token', token);
    }
    if (verifyJson.refreshToken) {
      localStorage.setItem('refresh_token', verifyJson.refreshToken);
    }

    if (verifyJson.user?.id) {
      localStorage.setItem('webauthn_user_id', verifyJson.user.id.toString());
    }

    setHasPasskeyFlag(true);

    return { success: true, message: 'Login con passkey effettuato con successo.' };
  } catch (error: any) {
    console.error('❌ Errore durante loginWithPasskey:', error);
    // Se l'utente annulla il prompt di sistema, alcuni browser lanciano NotAllowedError
    if (error?.name === 'NotAllowedError') {
      return { success: false, message: 'Login annullato o non riuscito.', code: 'CANCELLED' };
    }
    return {
      success: false,
      message: error?.message || 'Errore imprevisto durante il login con passkey.',
    };
  }
}

