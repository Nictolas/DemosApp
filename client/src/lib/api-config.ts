// Configurazione centralizzata per l'API
declare const importMetaEnv: Record<string, string | undefined> & { VITE_API_BASE_URL?: string };

const resolveBaseUrl = (): string => {
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/api';
  }

  if (typeof importMetaEnv !== 'undefined' && importMetaEnv.VITE_API_BASE_URL) {
    return importMetaEnv.VITE_API_BASE_URL;
  }

  return 'https://demos-c7k0.onrender.com/api';
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