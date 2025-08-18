// Configurazione centralizzata per l'API
declare const importMetaEnv: Record<string, string | undefined> & { VITE_API_BASE_URL?: string };

const resolveBaseUrl = (): string => {
  // 1) Preferisci variabile d'ambiente (obbligatoria in produzione)
  const envUrl = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_API_BASE_URL
    ? (import.meta as any).env.VITE_API_BASE_URL
    : (typeof importMetaEnv !== 'undefined' ? importMetaEnv.VITE_API_BASE_URL : undefined))?.trim();
  if (envUrl) return envUrl.replace(/\/$/, '');

  // 2) Controlla se siamo in produzione (Vercel)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return 'https://demos-c7k0.onrender.com/api';
  }

  // 3) Fallback sviluppo locale
  return 'http://localhost:3001/api';
};

export const API_CONFIG = {
  BASE_URL: resolveBaseUrl(),
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register', 
    LOGOUT: '/auth/logout',
    ME: '/utenti/me',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password'
  }
} as const;
5
// Helper per costruire URL completi
export const getApiUrl = (endpoint: string) => {
  const url = `${API_CONFIG.BASE_URL}${endpoint}`;
  console.log('API URL:', url); // Debug
  return url;
};
