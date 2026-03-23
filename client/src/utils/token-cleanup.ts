/**
 * 🔧 Utility per la pulizia dei token scaduti
 * 
 * Questo script aiuta a pulire i token scaduti dal localStorage
 * e gestire meglio l'autenticazione.
 */

import { clearSessionTokens, getAuthToken } from "@/lib/auth-token";

export const cleanupExpiredTokens = () => {
  try {
    const authToken = getAuthToken();
    
    if (authToken) {
      try {
        // Decodifica il token per controllare la scadenza
        const payload = JSON.parse(atob(authToken.split('.')[1]));
        const now = Math.floor(Date.now() / 1000);
        
        if (payload.exp && payload.exp < now) {
          console.log('🧹 Token scaduto rilevato, pulizia in corso...');
          clearSessionTokens();
          return true; // Token rimosso
        }
      } catch (error) {
        console.log('🧹 Token malformato rilevato, pulizia in corso...');
        clearSessionTokens();
        return true; // Token rimosso
      }
    }
    
    return false; // Nessun token da rimuovere
  } catch (error) {
    console.error('❌ Errore durante la pulizia dei token:', error);
    return false;
  }
};

export const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    const now = Math.floor(Date.now() / 1000);
    return payload.exp && payload.exp < now;
  } catch (error) {
    return true; // Se non riesco a decodificare, considero scaduto
  }
};

export const getTokenExpirationTime = (token: string): number | null => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? payload.exp * 1000 : null; // Converti in millisecondi
  } catch (error) {
    return null;
  }
};
