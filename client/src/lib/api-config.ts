// Configurazione centralizzata per l'API
declare const importMetaEnv: Record<string, string | undefined> & { VITE_API_BASE_URL?: string };

const resolveBaseUrl = (): string => {
  // Controlla se siamo in produzione (Render)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    return '/api'; // Usa URL relativo per evitare problemi CORS
  }

  // Sviluppo locale
  return 'http://localhost:3001/api';
};

export const API_CONFIG = {
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register', 
    LOGOUT: '/auth/logout',
    ME: '/auth/me',
    FORGOT_PASSWORD: '/auth/forgot-password',
    RESET_PASSWORD: '/auth/reset-password',
    CHANGE_PASSWORD: '/auth/change-password',
    RESEND_VERIFICATION: '/auth/resend-verification'
  }
} as const;

// Helper per costruire URL completi
export const getApiUrl = (endpoint: string) => {
  const baseUrl = resolveBaseUrl();
  
  // Correggi il problema del double /api
  let cleanEndpoint = endpoint;
  if (endpoint.startsWith('/api/')) {
    cleanEndpoint = endpoint.substring(4); // Rimuovi /api/ iniziale
  } else if (endpoint.startsWith('/')) {
    cleanEndpoint = endpoint; // Mantieni / iniziale
  } else {
    cleanEndpoint = `/${endpoint}`; // Aggiungi / iniziale se mancante
  }
  
  const url = `${baseUrl}${cleanEndpoint}`;
  return url;
};
