// Configurazione centralizzata per l'API
export const API_CONFIG = {
  BASE_URL: 'http://localhost:3001/api',
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
