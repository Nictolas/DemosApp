import { Capacitor } from '@capacitor/core';

// Endpoint pubblico canonico ripristinato il 16/10/2026.
const CANONICAL_API_BASE_URL = 'https://api.demos.community/api';
// Fallback nativo temporaneo: la build Alpha 1.0.7(9) è già congelata/in revisione
// e il passaggio del client nativo al dominio canonico va qualificato nella release successiva.
const NATIVE_API_FALLBACK_URL = 'https://demos-c7k0.onrender.com/api';

const normalizeApiBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const getConfiguredBaseUrl = (): string => {
  const env = (import.meta as any).env || {};
  // Il progetto storico usa entrambe le convenzioni; supportarle evita che una
  // build ignori una configurazione esplicita dell'endpoint API.
  return normalizeApiBaseUrl(env.VITE_API_BASE_URL || env.VITE_API_URL || '');
};

const resolveBaseUrl = (): string => {
  const configuredBaseUrl = getConfiguredBaseUrl();

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/api';
  }

  if (Capacitor.isNativePlatform()) {
    return configuredBaseUrl || NATIVE_API_FALLBACK_URL;
  }

  return configuredBaseUrl || CANONICAL_API_BASE_URL;
};

export const API_CONFIG = {
  AUTH: {
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    REFRESH: '/auth/refresh',
  },
  WEBAUTHN: {
    DEVICE_STATUS: '/auth/webauthn/device/status',
    REGISTER_OPTIONS: '/auth/webauthn/register/options',
    REGISTER_VERIFY: '/auth/webauthn/register/verify',
    LOGIN_OPTIONS: '/auth/webauthn/login/options',
    LOGIN_VERIFY: '/auth/webauthn/login/verify',
  },
  OAUTH: {
    CONFIG: '/auth/oauth/config',
    GOOGLE: '/auth/oauth/google',
    APPLE: '/auth/oauth/apple',
  },
} as const;

export const getApiUrl = (endpoint: string | undefined | null) => {
  if (!endpoint || typeof endpoint !== 'string') {
    console.error('getApiUrl - endpoint non valido:', endpoint);
    throw new Error(`Endpoint non valido: ${endpoint}`);
  }

  const baseUrl = resolveBaseUrl();

  let cleanEndpoint = endpoint;
  if (endpoint === '/api') {
    cleanEndpoint = '';
  } else if (endpoint.startsWith('/api?')) {
    cleanEndpoint = endpoint.substring(4);
  } else if (endpoint.startsWith('/api/')) {
    cleanEndpoint = endpoint.substring(4);
  } else if (!endpoint.startsWith('/')) {
    cleanEndpoint = `/${endpoint}`;
  }

  return `${baseUrl}${cleanEndpoint}`;
};
