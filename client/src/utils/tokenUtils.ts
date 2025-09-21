/**
 * 🧹 UTILITY PER GESTIONE TOKEN
 * 
 * Funzioni per gestire i token JWT e pulire token vecchi
 */

/**
 * Pulisce tutti i token dal localStorage e forza un nuovo login
 */
export const clearAllTokens = () => {
  console.log('🧹 Pulizia token in corso...');
  
  // Rimuovi tutti i token dal localStorage
  localStorage.removeItem('auth_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_token');
  localStorage.removeItem('token');
  
  // Rimuovi anche eventuali altri dati di sessione
  localStorage.removeItem('user');
  localStorage.removeItem('user_data');
  localStorage.removeItem('session');
  
  console.log('🧹 Token puliti, reindirizzamento al login...');
  
  // Reindirizza al login
  window.location.href = '/auth';
};

/**
 * Verifica se il token è valido controllando la sua struttura
 */
export const isTokenValid = (token: string): boolean => {
  if (!token) return false;
  
  try {
    // Decodifica il token senza verificare la firma
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    
    const payload = JSON.parse(atob(parts[1]));
    
    // Controlla se ha i campi essenziali
    if (!payload.userId && !payload.email) return false;
    
    // Controlla se è scaduto
    if (payload.exp && payload.exp < Date.now() / 1000) return false;
    
    // Controlla se ha l'audience corretto
    if (payload.aud !== 'demosapp-users') {
      console.warn('⚠️ Token con audience non valido:', payload.aud);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('❌ Errore nella verifica token:', error);
    return false;
  }
};

/**
 * Ottiene il token dal localStorage e verifica se è valido
 */
export const getValidToken = (): string | null => {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    console.log('🔍 Nessun token trovato');
    return null;
  }
  
  if (!isTokenValid(token)) {
    console.log('🔍 Token non valido, pulizia in corso...');
    clearAllTokens();
    return null;
  }
  
  return token;
};

/**
 * Forza il refresh del token chiamando l'endpoint di pulizia
 */
export const forceTokenRefresh = async (): Promise<void> => {
  try {
    console.log('🔄 Forzando refresh token...');
    
    // Chiama l'endpoint di pulizia token
    const response = await fetch('/api/auth/clear-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (response.ok) {
      console.log('✅ Token refresh richiesto con successo');
    } else {
      console.warn('⚠️ Errore nel refresh token, pulizia locale...');
    }
  } catch (error) {
    console.error('❌ Errore nel refresh token:', error);
  } finally {
    // In ogni caso, pulisci i token localmente
    clearAllTokens();
  }
};
