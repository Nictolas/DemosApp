import { Capacitor } from '@capacitor/core';

// Configurazione centralizzata per l'API
const DEFAULT_API_BASE_URL = 'https://demos-c7k0.onrender.com/api';

const normalizeApiBaseUrl = (value: string): string => {
  const trimmed = value.trim().replace(/\/+$/, '');
  if (!trimmed) return '';
  return trimmed.endsWith('/api') ? trimmed : `${trimmed}/api`;
};

const getConfiguredBaseUrl = (): string => {
  const env = (import.meta as any).env || {};
  // Il progetto storico usa entrambe le convenzioni; supportarle evita che una
  // build Android ignori VITE_API_URL e ricada involontariamente sul fallback.
  return normalizeApiBaseUrl(env.VITE_API_BASE_URL || env.VITE_API_URL || '');
};

const resolveBaseUrl = (): string => {
  // Android/iOS usano temporaneamente l'endpoint Render diretto: api.demos.community
  // è attualmente bloccato da Cloudflare Error 1000. Non lasciare che una variabile
  // Vite web sovrascriva il backend nativo finché il custom domain non è riparato.
  if (Capacitor.isNativePlatform()) {
    return DEFAULT_API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/api';
  }

  return getConfiguredBaseUrl() || DEFAULT_API_BASE_URL;
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
