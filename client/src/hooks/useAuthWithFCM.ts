import { useState, useEffect } from 'react';
import { useFCM } from './useFCM';

interface LoginData {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  [key: string]: any;
}

export function useAuthWithFCM() {
  const { token: fcmToken, error: fcmError, permission } = useFCM();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const login = async (loginData: LoginData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...loginData,
          fcmToken: fcmToken // Invia automaticamente il token FCM
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Errore durante il login');
      }

      const user = await response.json();
      return { success: true, user };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore durante il login';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (registerData: RegisterData) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...registerData,
          fcmToken: fcmToken // Invia automaticamente il token FCM
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore durante la registrazione');
      }

      const result = await response.json();
      return { success: true, user: result.user };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore durante la registrazione';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await fetch('/api/logout', {
        method: 'POST',
        credentials: 'include'
      });
      return { success: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Errore durante il logout';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    }
  };

  return {
    login,
    register,
    logout,
    isLoading,
    error,
    fcmToken,
    fcmError,
    permission
  };
} 
