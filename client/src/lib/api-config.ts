// Configurazione centralizzata per l'API
declare const importMetaEnv: Record<string, string | undefined> & { VITE_API_BASE_URL?: string };

const resolveBaseUrl = (): string => {
  // Controlla se siamo in produzione (Vercel)
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost') {
    console.log('Production detected, using Render API');
    return 'https://demos-c7k0.onrender.com/api';
  }

  // Sviluppo locale
  console.log('Development detected, using localhost API');
  return 'http://localhost:3001/api';
};

export const API_CONFIG = {
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

// Helper per costruire URL completi
export const getApiUrl = (endpoint: string) => {
  console.log('getApiUrl called with endpoint:', endpoint);
  console.log('window.location.hostname:', typeof window !== 'undefined' ? window.location.hostname : 'window not available');
  
  const baseUrl = resolveBaseUrl();
  console.log('baseUrl resolved to:', baseUrl);
  
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
  console.log('Final API URL:', url);
  return url;
};
