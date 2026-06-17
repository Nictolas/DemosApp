import { createContext, ReactNode, useContext, useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
  useQueryClient
} from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { getApiUrl, API_CONFIG } from "@/lib/api-config";
import { cleanupExpiredTokens } from "@/utils/token-cleanup";
import { clearSessionTokens, getAuthToken, setAuthToken } from "@/lib/auth-token";

// Tipi per l'autenticazione
interface User {
  id: string;
  email: string;
  name?: string;  // Campo opzionale per compatibilit├á con API
  nome?: string;  // Campo italiano per compatibilit├á con API
  cognome?: string; // Campo italiano per compatibilit├á con API
  role?: string;
  ruolo?: string; // Campo italiano per compatibilit├á con API
  status?: string; // Status dell'utente: pending, verified, approved
}

interface LoginCredentials {
  email: string;
  password: string;
}

interface RegisterData {
  email: string;
  password: string;
  name?: string;  // Campo opzionale per compatibilit├á
  nome?: string;  // Campo italiano per compatibilit├á
  cognome?: string; // Campo italiano per compatibilit├á
  privacy_policy_consent?: boolean;
  terms_of_service_consent?: boolean;
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isError: boolean;
  isAuthenticated: boolean;
  loginMutation: UseMutationResult<User, Error, LoginCredentials>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<User, Error, RegisterData>;
  // Nessun resend/forgot-password: il sistema non usa pi├╣ le email.
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
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = getAuthToken();
    if (storedToken) {
      // Pulisci token scaduti prima di impostare il token
      const wasCleaned = cleanupExpiredTokens();
      return wasCleaned ? null : storedToken;
    }
    return null;
  });

  // Query per ottenere l'utente corrente
  const { data: userData, isLoading, isError } = useQuery<User | null>({
    queryKey: ['user', token], // Aggiungi token alla queryKey per forzare il refetch quando cambia
    queryFn: async () => {
      if (!token) {
        console.log('­ƒöì DEBUG useAuth - Nessun token disponibile');
        return null;
      }
      
      console.log('­ƒöì DEBUG useAuth - Token disponibile, chiamando API');
      console.log('­ƒöì DEBUG useAuth - Token value:', token.substring(0, 20) + '...');
      
      // Aggiungi timeout alla richiesta
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 secondi timeout
      
      try {
        const response = await fetch(getApiUrl(API_CONFIG.AUTH.ME), {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        console.log('­ƒöì DEBUG useAuth - Response status:', response.status);
        console.log('­ƒöì DEBUG useAuth - Response headers:', Object.fromEntries(response.headers.entries()));

        if (response.status === 401) {
          console.log('­ƒöì DEBUG useAuth - Token non valido o scaduto, rimuovendo');
          clearSessionTokens();
          setToken(null);
          return null;
        }

        if (response.status === 404) {
          // Utente non trovato (es. account eliminato o token non pi├╣ valido)
          clearSessionTokens();
          return null;
        }

        if (!response.ok) {
          const errorText = await response.text();
          console.error('­ƒöì DEBUG useAuth - Errore risposta /auth/me:', response.status, errorText);
          // In caso di errore generico (500, rete, ecc.) considera l'utente come non caricato
          return null;
        }

        const result = await response.json();
        return result.success ? result.user : null;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('­ƒöì DEBUG useAuth - Timeout della richiesta');
          // Tratta il timeout come mancata risposta: non mandare l'utente ad /auth
          return null;
        }
        console.error('­ƒöì DEBUG useAuth - Errore fetch /auth/me:', error);
        return null;
      }
    },
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minuti - evita refetch continui
    refetchOnWindowFocus: false, // Evita refetch quando si torna alla finestra
    refetchOnMount: false, // Evita refetch al mount se i dati sono ancora validi
  });

  // Se abbiamo token ma /me ha restituito null (es. 404), sincronizza lo state
  useEffect(() => {
    if (!isLoading && userData === null && token) {
      if (!getAuthToken()) setToken(null);
    }
  }, [isLoading, userData, token]);

  // Se /auth/me non restituisce un utente ma abbiamo un token valido, prova a decodificare il JWT
  // cos├¼ almeno id e ruolo sono disponibili e l'app riconosce l'utente come autenticato.
  let user: User | null = userData ?? null;
  if (!user && token) {
    try {
      const payloadJson = atob(token.split('.')[1] || '');
      const payload = JSON.parse(payloadJson);
      if (payload && payload.userId) {
        user = {
          id: payload.userId,
          email: payload.email || '',
          ruolo: payload.role,
          role: payload.role,
          status: payload.status || 'a',
        };
      }
    } catch (e) {
      console.error('ÔØî useAuth - Errore nella decodifica del token JWT:', e);
    }
  }

  // Mutation per il login
  const loginMutation = useMutation<User, Error, LoginCredentials>({
    mutationFn: async (credentials) => {
      const apiUrl = getApiUrl(API_CONFIG.AUTH.LOGIN);
      console.log('­ƒöÉ LOGIN CLIENT: Tentativo di login per', credentials.email);
      console.log('­ƒöÉ LOGIN CLIENT: URL API:', apiUrl);
      
      // Aggiungi timeout alla richiesta di login (30 secondi per dare pi├╣ tempo al server)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log('ÔÅ▒´©Å LOGIN CLIENT: Timeout della richiesta dopo 30 secondi');
        controller.abort();
      }, 30000); // 30 secondi timeout
      
      try {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(credentials),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);

        console.log('­ƒöÉ LOGIN CLIENT: Risposta ricevuta, status:', response.status);
        
        // Leggi il testo della risposta per debug
        const responseText = await response.text();
        console.log('­ƒöÉ LOGIN CLIENT: Risposta raw:', responseText.substring(0, 200));
        
        let result;
        try {
          result = JSON.parse(responseText);
          console.log('­ƒöÉ LOGIN CLIENT: Risposta parsata:', {
            success: result.success,
            hasAccessToken: !!result.accessToken,
            hasUser: !!result.user,
            error: result.error
          });
        } catch (parseError) {
          console.error('ÔØî LOGIN CLIENT: Errore parsing JSON:', parseError);
          throw new Error('Risposta non valida dal server');
        }
        
        if (!response.ok) {
          // Gestisci il caso speciale di email non verificata
          if (result.requiresVerification) {
            const verificationError = new Error(result.error || 'Email non verificata');
            (verificationError as any).requiresVerification = true;
            (verificationError as any).email = credentials.email;
            throw verificationError;
          }
          
          throw new Error(result.error || result.message || 'Login fallito');
        }
        
        if (!result.success) {
          throw new Error(result.error || result.message || 'Login fallito');
        }

        // Verifica che il token esista
        const userToken = result.accessToken || result.token;
        if (!userToken) {
          console.error('ÔØî LOGIN CLIENT: Token mancante nella risposta');
          throw new Error('Token di autenticazione non ricevuto dal server');
        }

        // Salva il token JWT reale
        setAuthToken(userToken);
        setToken(userToken);
        console.log('Ô£à LOGIN CLIENT: Token salvato con successo');

        if (!result.user) {
          console.error('ÔØî LOGIN CLIENT: Dati utente mancanti nella risposta');
          throw new Error('Dati utente non ricevuti dal server');
        }

        return result.user;
      } catch (error: any) {
        clearTimeout(timeoutId);
        
        // Gestisci il caso di timeout
        if (error instanceof Error && error.name === 'AbortError') {
          console.error('ÔØî LOGIN CLIENT: Timeout della richiesta di login');
          throw new Error('Il server sta impiegando troppo tempo a rispondere. Riprova tra qualche istante.');
        }
        
        // Se ├¿ gi├á un Error, rilancialo
        if (error instanceof Error) {
          console.error('ÔØî LOGIN CLIENT: Errore durante login:', error.message);
          throw error;
        }
        
        // Altrimenti crea un nuovo Error
        console.error('ÔØî LOGIN CLIENT: Errore sconosciuto:', error);
        throw new Error(error?.message || 'Errore di connessione. Verifica la tua connessione internet.');
      }
    },
    onSuccess: (data) => {
      // Ottieni il token appena salvato
      const userToken = getAuthToken();
      
      // Salva i dati utente con la queryKey corretta che include il token
      if (userToken) {
        queryClient.setQueryData(['user', userToken], data);
      }
      
      // Invalida e refetch la query per forzare il refresh dei dati utente
      queryClient.invalidateQueries({ queryKey: ['user'] });
      queryClient.refetchQueries({ queryKey: ['user'] });
      
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
      
      // Reindirizza ai preferiti dopo il login di successo
      // Usa un piccolo delay per assicurarsi che i dati siano salvati
      setTimeout(() => {
        window.location.href = '/preferiti';
      }, 100);
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
      clearSessionTokens();
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
        // Ignora errori di logout, il token ├¿ gi├á rimosso
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

  // Mutation per la registrazione (l'account viene attivato subito, senza verifica email)
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

      // Il backend ora attiva subito l'account e pu├▓ restituire anche i token.
      const userToken = result.accessToken || result.token || null;
      setAuthToken(userToken);
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
      queryClient.setQueryData(['user'], data);
      toast({ 
        title: "Registrazione completata!", 
        description: `Benvenuto ${data.nome || data.email}`,
        variant: "default"
      });
      
      // Reindirizza ai preferiti dopo la registrazione completata
      window.location.href = '/preferiti';
    },
  });

  const isAuthenticated = !!token;

  return (
    <AuthContext.Provider 
      value={{
        user,
        isLoading,
        isError,
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
