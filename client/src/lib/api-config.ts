// Configurazione centralizzata per l'API
declare const importMetaEnv: Record<string, string | undefined> & { VITE_API_BASE_URL?: string };

const resolveBaseUrl = (): string => {
  // Controlla se siamo in sviluppo locale
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return '/api'; // Usa il proxy di Vite
  }
  
  // Se VITE_API_BASE_URL è definito, usalo
  if (typeof importMetaEnv !== 'undefined' && importMetaEnv.VITE_API_BASE_URL) {
    return importMetaEnv.VITE_API_BASE_URL;
  }
  
  // Produzione - usa il server di produzione
  // Il frontend è statico, quindi dobbiamo usare l'URL completo del backend API
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    // Se siamo su demos.community o www.demos.community, usa api.demos.community
    if (hostname === 'demos.community' || hostname === 'www.demos.community') {
      return 'https://api.demos.community/api'; // Usa il dominio API dedicato
    }
  }
  
  return 'https://demos-c7k0.onrender.com/api';
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
