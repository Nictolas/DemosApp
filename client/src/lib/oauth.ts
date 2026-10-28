/**
 * Login con Google e Apple (OAuth).
 * Ottiene id_token dal provider e lo invia al backend per ricevere JWT Demos.
 * Su iOS/Safari il One Tap spesso non funziona: si usa il flusso redirect.
 */
import { getApiUrl, API_CONFIG } from "./api-config";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: IdConfiguration) => void;
          prompt: (momentListener?: (notification: unknown) => void) => void;
        };
      };
    };
    AppleID?: {
      auth: {
        init: (config: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }) => void;
        signIn: () => Promise<{ authorization: { id_token: string } }>;
      };
    };
  }
}

interface IdConfiguration {
  client_id: string;
  callback: (res: { credential: string }) => void;
  itp_support?: boolean;
  ux_mode?: "popup" | "redirect";
  login_uri?: string;
}

let runtimeGoogleClientId = "";
let runtimeAppleClientId = "";
let runtimeConfigLoaded = false;
let runtimeConfigPromise: Promise<void> | null = null;

function getBuildTimeGoogleClientId(): string {
  return (import.meta as any).env?.VITE_GOOGLE_CLIENT_ID || "";
}

function getBuildTimeAppleClientId(): string {
  return (import.meta as any).env?.VITE_APPLE_CLIENT_ID || "";
}

export function getGoogleClientId(): string {
  // Quando disponibile, il valore runtime del backend è autorevole: garantisce
  // che l'audience richiesta dal client coincida con quella verificata dal server.
  return runtimeGoogleClientId || getBuildTimeGoogleClientId();
}

export function getAppleClientId(): string {
  return runtimeAppleClientId || getBuildTimeAppleClientId();
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Carica i Client ID OAuth pubblici dal backend quando non sono stati incorporati
 * nella build Vite. Questo è particolarmente importante per le build Capacitor,
 * che non devono dipendere dalla presenza di VITE_* sulla macchina che genera APK/AAB.
 *
 * Il caricamento è retryable: su un backend freddo o su una rete instabile non
 * memorizziamo permanentemente un fallimento che renderebbe invisibile il login.
 */
export async function loadOAuthConfig(): Promise<void> {
  if (runtimeConfigLoaded) return;
  if (runtimeConfigPromise) return runtimeConfigPromise;

  runtimeConfigPromise = (async () => {
    let loadedFromBackend = false;
    let lastError: unknown = null;

    try {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        try {
          const res = await fetch(getApiUrl(API_CONFIG.OAUTH.CONFIG), {
            method: "GET",
            headers: { Accept: "application/json" },
            cache: "no-store",
          });
          const data = await res.json().catch(() => ({}));
          if (!res.ok || !data?.success) {
            throw new Error(`OAuth config HTTP ${res.status}`);
          }

          runtimeGoogleClientId = typeof data.googleClientId === "string" ? data.googleClientId : "";
          runtimeAppleClientId = typeof data.appleClientId === "string" ? data.appleClientId : "";
          runtimeConfigLoaded = true;
          loadedFromBackend = true;
          return;
        } catch (error) {
          lastError = error;
          if (attempt < 3) await sleep(500 * attempt);
        }
      }
    } finally {
      runtimeConfigPromise = null;
      // Se la build contiene già almeno un ID possiamo continuare in fallback.
      // In assenza di fallback lasciamo runtimeConfigLoaded=false, così un tap
      // successivo su Android ritenta il bootstrap invece di restare bloccato.
      if (!loadedFromBackend && (getBuildTimeGoogleClientId() || getBuildTimeAppleClientId())) {
        runtimeConfigLoaded = true;
      }
      if (!loadedFromBackend && lastError) {
        console.warn("Configurazione OAuth runtime non disponibile:", lastError);
      }
    }
  })();

  return runtimeConfigPromise;
}

function saveTokensFromResponse(data: { accessToken?: string; refreshToken?: string; user?: { id: string } }) {
  const token = data.accessToken || (data as any).token;
  if (token) localStorage.setItem("auth_token", token);
  if (data.refreshToken) localStorage.setItem("refresh_token", data.refreshToken);
  if (data.user?.id) localStorage.setItem("webauthn_user_id", String(data.user.id));
}

/** Rileva iOS o Safari mobile (dove il One Tap spesso non funziona). */
export function isIOSOrMobileSafari(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/i.test(ua);
  const isSafari = /Safari/i.test(ua) && !/Chrome|CriOS|FxiOS/i.test(ua);
  return isIOS || (isSafari && /Mobile/i.test(ua));
}

/**
 * Carica lo script Google Identity Services e inizializza con callback.
 * Il callback riceve l'id_token quando l'utente completa il login.
 * itp_support: true per Safari/ITP (One Tap migliorato dove supportato).
 */
export function loadAndInitGoogle(
  onCredential: (idToken: string) => Promise<void>
): Promise<void> {
  const clientId = getGoogleClientId();
  if (!clientId) return Promise.reject(new Error("Google OAuth non configurato"));

  const config: IdConfiguration = {
    client_id: clientId,
    callback: async (res) => {
      try {
        await onCredential(res.credential);
      } catch (e) {
        console.error("Errore callback Google:", e);
      }
    },
    itp_support: true,
  };

  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.id) {
      window.google.accounts.id.initialize(config);
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (!window.google?.accounts?.id) {
        reject(new Error("Script Google caricato ma API non disponibile"));
        return;
      }
      window.google.accounts.id.initialize(config);
      resolve();
    };
    script.onerror = () => reject(new Error("Impossibile caricare lo script Google"));
    document.head.appendChild(script);
  });
}

/**
 * Mostra il prompt "Accedi con Google" (One Tap o account picker).
 */
export function triggerGoogleLogin(): void {
  if (window.google?.accounts?.id) {
    window.google.accounts.id.prompt();
  }
}

const GOOGLE_LOGIN_TIMEOUT_MS = 90000;

/**
 * Esegue login con Google: mostra prompt, alla selezione account invia id_token al backend e salva i token.
 * Su iOS/Safari il prompt spesso non completa: dopo 90s la Promise si risolve con errore per evitare caricamento infinito.
 */
export function loginWithGoogle(): Promise<{ success: boolean; message?: string; isNew?: boolean }> {
  const clientId = getGoogleClientId();
  if (!clientId) {
    return Promise.resolve({ success: false, message: "Login Google non configurato." });
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: { success: boolean; message?: string; isNew?: boolean }) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const timeoutId = window.setTimeout(() => {
      finish({
        success: false,
        message: "Tempo scaduto. Su iPhone usa \"Accedi con passkey\" oppure apri da PC per accedere con Google.",
      });
    }, GOOGLE_LOGIN_TIMEOUT_MS);

    loadAndInitGoogle(async (idToken) => {
      window.clearTimeout(timeoutId);
      if (settled) return;
      const result = await sendGoogleIdTokenToBackend(idToken);
      finish(result);
    })
      .then(() => {
        triggerGoogleLogin();
      })
      .catch((e: unknown) => {
        window.clearTimeout(timeoutId);
        finish({
          success: false,
          message: (e as Error)?.message || "Errore durante l'accesso con Google.",
        });
      });
  });
}

/**
 * Costruisce l'URL per il redirect OAuth Google (flusso id_token implicito).
 * Usato su iOS/Safari dove il One Tap non funziona.
 */
function buildGoogleRedirectUrl(): string {
  const clientId = getGoogleClientId();
  if (!clientId) return "";
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const redirectUri = `${origin}/auth`;
  const scope = "openid email";
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("google_oauth_nonce", nonce);
  }
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "id_token",
    scope,
    nonce,
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

/** Avvia il login con Google tramite redirect. */
export function loginWithGoogleRedirect(): void {
  const url = buildGoogleRedirectUrl();
  if (!url) return;
  window.location.href = url;
}

/** Legge id_token dall'hash dopo redirect Google e lo invia al backend. */
export function handleGoogleRedirectCallback(): Promise<{ success: boolean; message?: string; isNew?: boolean } | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const hash = window.location.hash?.slice(1) || "";
  const params = new URLSearchParams(hash);
  const idToken = params.get("id_token");
  if (!idToken) return Promise.resolve(null);
  const cleanUrl = window.location.pathname + window.location.search;
  window.history.replaceState(null, "", cleanUrl);
  return sendGoogleIdTokenToBackend(idToken);
}

/** Invia id_token Google al backend. */
export async function sendGoogleIdTokenToBackend(idToken: string): Promise<{ success: boolean; message?: string; isNew?: boolean }> {
  try {
    const res = await fetch(getApiUrl(API_CONFIG.OAUTH.GOOGLE), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, message: data.error || data.message || "Accesso con Google non riuscito" };
    }
    saveTokensFromResponse(data);
    return { success: true, isNew: !!data.isNew };
  } catch (e: any) {
    return { success: false, message: e?.message || "Errore di rete" };
  }
}

/** Carica lo script Sign in with Apple e inizializza. */
function loadAppleScript(): Promise<void> {
  if (window.AppleID?.auth) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/en/appleid.auth.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Impossibile caricare lo script Apple"));
    document.head.appendChild(script);
  });
}

/** Login con Apple: popup Apple, invio identityToken al backend, salvataggio token. */
export async function loginWithApple(): Promise<{ success: boolean; message?: string; isNew?: boolean }> {
  const clientId = getAppleClientId();
  if (!clientId) {
    return { success: false, message: "Login Apple non configurato." };
  }

  try {
    await loadAppleScript();
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    if (!window.AppleID?.auth) {
      return { success: false, message: "Sign in with Apple non disponibile." };
    }

    window.AppleID.auth.init({
      clientId,
      scope: "email",
      redirectURI: `${origin}/auth`,
      usePopup: true,
    });

    const { authorization } = await window.AppleID.auth.signIn();
    const idToken = authorization?.id_token;
    if (!idToken) {
      return { success: false, message: "Token Apple non ricevuto." };
    }

    const res = await fetch(getApiUrl(API_CONFIG.OAUTH.APPLE), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.success) {
      return { success: false, message: data.error || data.message || "Accesso con Apple non riuscito" };
    }
    saveTokensFromResponse(data);
    return { success: true, isNew: !!data.isNew };
  } catch (e: any) {
    if (e?.error === "popup_closed_by_user" || e?.message?.toLowerCase?.().includes("popup")) {
      return { success: false, message: "Accesso annullato." };
    }
    return {
      success: false,
      message: e?.message || "Errore durante l'accesso con Apple.",
    };
  }
}
