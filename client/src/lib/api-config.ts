import { Capacitor } from '@capacitor/core';

// Configurazione centralizzata per l'API
const DEFAULT_API_BASE_URL = 'https://demos-c7k0.onrender.com/api';

const getConfiguredBaseUrl = (): string => {
  return (import.meta as any).env?.VITE_API_BASE_URL || '';
};

const resolveBaseUrl = (): string => {
  // Capacitor serve la WebView da https://localhost: non va confusa con il
  // localhost di sviluppo. Su Android/iOS l'API deve puntare al backend Render.
  if (Capacitor.isNativePlatform()) {
    return getConfiguredBaseUrl() || DEFAULT_API_BASE_URL;
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
  if (endpoint.startsWith('/api/')) {
    cleanEndpoint = endpoint.substring(4);
  } else if (!endpoint.startsWith('/')) {
    cleanEndpoint = `/${endpoint}`;
  }

  return `${baseUrl}${cleanEndpoint}`;
};
