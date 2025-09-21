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
  status?: string; // Status dell'utente: pending, verified, approved
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
  privacy_policy_consent?: boolean;
  terms_of_service_consent?: boolean;
  cookie_policy_consent?: boolean;
}

interface ForgotPasswordData {
  email: string;
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  loginMutation: UseMutationResult<User, Error, LoginCredentials>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  resendVerificationEmail: (email: string) => Promise<any>;
  forgotPasswordMutation: UseMutationResult<any, Error, ForgotPasswordData>;
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
    queryKey: ['user', token], // Aggiungi token alla queryKey per forzare il refetch quando cambia
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
        // Token non valido, rimuovilo e forza logout
        localStorage.removeItem('auth_token');
        setToken(null);
        // Forza refresh della pagina per pulire completamente lo stato
        window.location.reload();
        return null;
      }

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error('Errore nel caricamento utente');
      }

      const result = await response.json();
      return result.success ? result.user : null;
    },
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minuti - evita refetch continui
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

      const result = await response.json();
      
      if (!response.ok) {
        // Gestisci il caso speciale di email non verificata
        if (result.requiresVerification) {
          const verificationError = new Error(result.error || 'Email non verificata');
          (verificationError as any).requiresVerification = true;
          (verificationError as any).email = credentials.email;
          throw verificationError;
        }
        
        throw new Error(result.error || 'Login fallito');
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Login fallito');
      }

      // Salva il token JWT reale
      const userToken = result.accessToken || result.token || 'mock_token_' + Date.now();
      localStorage.setItem('auth_token', userToken);
      setToken(userToken);

      return result.user; // ✅ Restituisce result.user invece di result.data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data);
      // Invalida e refetch la query per forzare il refresh dei dati utente
      queryClient.invalidateQueries(['user']);
      queryClient.refetchQueries(['user']);
      
      // Controlla lo status dell'utente
      if (data.status === 'pending') {
        // Salva l'email per la verifica
        localStorage.setItem('user_email', data.email);
        localStorage.setItem('user_status', 'pending');
        localStorage.setItem('user_id', data.id);
        
        toast({ 
          title: "Email non verificata", 
          description: "Devi verificare la tua email prima di accedere al menu.",
          variant: "destructive"
        });
        
        // Reindirizza alla pagina di verifica email
        window.location.href = `/verifica-email?email=${encodeURIComponent(data.email)}`;
        return;
      }
      
      toast({ 
        title: "Login effettuato!", 
        description: `Benvenuto ${data.nome || data.email}`,
        variant: "default"
      });
      
      // Reindirizza al menu dopo il login di successo
      window.location.href = '/menu';
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
      
      // Redirect alla landing page
      window.location.href = '/';
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

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Registrazione fallita');
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Registrazione fallita');
      }

      // Se la registrazione richiede verifica email, restituisci i dati ma non salvare il token
      if (result.requiresVerification) {
        return {
          ...result.user,
          requiresVerification: true
        };
      }

      // Salva il token JWT reale solo se la registrazione è completamente completata
      const userToken = result.accessToken || result.token || 'mock_token_' + Date.now();
      localStorage.setItem('auth_token', userToken);
      setToken(userToken);

      return result.user;
    },

    onError: (error) => {
      toast({ 
        title: "Registrazione fallita", 
        description: error.message, 
        variant: "destructive" 
      });
    },
    onSuccess: (data) => {
      // Gestisci il caso di registrazione con verifica email richiesta
      if ((data as any).requiresVerification) {
        toast({ 
          title: "Registrazione completata!", 
          description: "Controlla la tua email per confermare l'account",
          variant: "default"
        });
        return;
      }
      
      // Solo se la registrazione è completamente completata (email verificata)
      queryClient.setQueryData(['user'], data);
      toast({ 
        title: "Registrazione completata!", 
        description: `Benvenuto ${data.nome || data.email}`,
        variant: "default"
      });
      
      // Reindirizza al menu dopo la registrazione completata
      window.location.href = '/menu';
    },
  });

  const isAuthenticated = !!user && !!token;

  // Funzione per reinviare email di verifica
  const resendVerificationEmail = async (email: string) => {
    try {
      const response = await fetch(getApiUrl(API_CONFIG.AUTH.RESEND_VERIFICATION), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Errore nel reinvio email');
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Errore nel reinvio email');
      }

      return result;
    } catch (error) {
      throw error;
    }
  };

  // Mutation per il reset password
  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordData) => {
      const response = await fetch(getApiUrl(API_CONFIG.AUTH.FORGOT_PASSWORD), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result = await response.json();
      
      if (!response.ok) {
        throw new Error(result.error || 'Errore nella richiesta reset password');
      }
      
      if (!result.success) {
        throw new Error(result.error || 'Errore nella richiesta reset password');
      }

      return result;
    },
    onError: (error) => {
      toast({ 
        title: "Errore", 
        description: error.message, 
        variant: "destructive" 
      });
    },
    onSuccess: (data) => {
      toast({ 
        title: "Email inviata!", 
        description: "Controlla la tua email per il link di reset password",
        variant: "default"
      });
    },
  });

  return (
    <AuthContext.Provider 
      value={{
        user,
        isLoading,
        isAuthenticated,
        loginMutation,
        logoutMutation,
        registerMutation,
        resendVerificationEmail,
        forgotPasswordMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
