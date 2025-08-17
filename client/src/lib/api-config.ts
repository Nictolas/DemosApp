// Configurazione centralizzata per l'API
const resolveBaseUrl = (): string => {
  // 1) Preferisci variabile d'ambiente (Vercel/Vite)
  const envUrl = import.meta.env?.VITE_API_BASE_URL as string | undefined;
  if (envUrl && envUrl.trim().length > 0) return envUrl;

  // 2) Se siamo in produzione (domini noti), usa Render
  if (typeof window !== 'undefined') {
    const host = window.location.host;
    if (host.includes('demos.community') || host.includes('vercel.app')) {
      return 'https://demos-c7x52aj0p2q2.onrender.com/api';
    }
  }

  // 3) Fallback sviluppo
  return 'http://localhost:3001/api';
};

export const API_CONFIG = {
  BASE_URL: resolveBaseUrl(),
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register', 
    LOGOUT: '/auth/logout',
    ME: '/utenti/me'
  }
} as const;

// Helper per costruire URL completi
export const getApiUrl = (endpoint: string) => {
  return `${API_CONFIG.BASE_URL}${endpoint}`;
};
