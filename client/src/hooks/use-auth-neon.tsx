import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
  useQueryClient
} from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl, API_CONFIG } from "@/lib/api-config";

// Tipi per l'autenticazione
interface User {
  id: string;
  email: string;
  name?: string;  // Campo opzionale per compatibilità con API
  nome?: string;  // Campo italiano per compatibilità con API
  cognome?: string; // Campo italiano per compatibilità con API
  role?: string;
  ruolo?: string; // Campo italiano per compatibilità con API
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  name?: string;  // Campo opzionale per compatibilità
  nome?: string;  // Campo italiano per compatibilità
  cognome?: string; // Campo italiano per compatibilità
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginMutation: UseMutationResult<User, Error, LoginCredentials>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

// Hook per usare il contesto di autenticazione
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth deve essere usato all\'interno di AuthProvider');
  }
  return context;
}

// Provider di autenticazione
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('auth_token')
  );

  // Query per ottenere l'utente corrente
  const { data: user, isLoading } = useQuery<User | null>({
    queryKey: ['user'],
    queryFn: async () => {
      if (!token) {
        console.log('🔍 DEBUG useAuth - Nessun token disponibile');
        return null;
      }
      
      console.log('🔍 DEBUG useAuth - Token disponibile, chiamando API');
      console.log('🔍 DEBUG useAuth - Token value:', token.substring(0, 20) + '...');
      
      const response = await fetch(getApiUrl(API_CONFIG.AUTH.ME), {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      console.log('🔍 DEBUG useAuth - Response status:', response.status);
      console.log('🔍 DEBUG useAuth - Response headers:', Object.fromEntries(response.headers.entries()));

      if (response.status === 401) {
        console.log('🔍 DEBUG useAuth - Token non valido, rimuovendo');
        // Token non valido, rimuovilo
        localStorage.removeItem('auth_token');
        setToken(null);
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.log('🔍 DEBUG useAuth - Response non ok:', errorText);
        throw new Error('Errore nel caricamento utente');
      }

      const result = await response.json();
      console.log('🔍 DEBUG useAuth - Response result:', result);
      return result.success ? result.user : null;
    },
    enabled: !!token,
    retry: false,
  });

  // Mutation per il login
  const loginMutation = useMutation<User, Error, LoginCredentials>({
    mutationFn: async (credentials) => {
      const response = await fetch(getApiUrl(API_CONFIG.AUTH.LOGIN), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Login fallito');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Login fallito');
      }

      // Salva il token
      const userToken = result.token || 'mock_token_' + Date.now();
      localStorage.setItem('auth_token', userToken);
      setToken(userToken);

      return result.user; // ✅ Restituisce result.user invece di result.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data);
      toast({ 
        title: "Login effettuato!", 
        description: `Benvenuto ${data.nome || data.email}`,
        variant: "default"
      });
    },
    onError: (error) => {
      toast({ 
        title: "Login fallito", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  // Mutation per il logout
  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      // Rimuovi il token localmente
      localStorage.removeItem('auth_token');
      setToken(null);
      
      // Opzionalmente, chiama endpoint di logout
      try {
        await fetch(getApiUrl(API_CONFIG.AUTH.LOGOUT), {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        });
      } catch (error) {
        // Ignora errori di logout, il token è già rimosso
        console.warn('Errore logout:', error);
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(['user'], null);
      queryClient.clear();
      toast({ 
        title: "Logout effettuato", 
        description: "Alla prossima!",
        variant: "default"
      });
    },
  });

  // Mutation per la registrazione
  const registerMutation = useMutation<User, Error, RegisterData>({
    mutationFn: async (userData) => {
      const response = await fetch(getApiUrl(API_CONFIG.AUTH.REGISTER), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Registrazione fallita');
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Registrazione fallita');
      }

      // Salva il token
      const userToken = result.token || 'mock_token_' + Date.now();
      localStorage.setItem('auth_token', userToken);
      setToken(userToken);

      return result.user;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data);
      toast({ 
        title: "Registrazione completata!", 
        description: `Benvenuto ${data.nome || data.email}`,
        variant: "default"
      });
    },
    onError: (error) => {
      toast({ 
        title: "Registrazione fallita", 
        description: error.message, 
        variant: "destructive" 
      });
    },
  });

  const isAuthenticated = !!user && !!token;

  return (
    <AuthContext.Provider 
      value={{
        user,
        isLoading,
        isAuthenticated,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
