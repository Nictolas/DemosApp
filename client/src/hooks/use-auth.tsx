import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { insertUserSchema, User as SelectUser, InsertUser } from "@shared/schema";
import { getQueryFn, apiRequest, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthReady } from "@/hooks/use-auth-ready";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<SelectUser, Error, InsertUser>;
};

type LoginData = Pick<InsertUser, "email" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const authReady = useAuthReady();
  const {
    data: user,
    error,
    isLoading,
    refetch,
  } = useQuery<SelectUser | undefined, Error>({
    queryKey: ["/api/user"],
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: authReady && !!auth.currentUser,
  });

  // Verifica periodica dell'autenticazione
  useEffect(() => {
    // Funzione per verificare l'autenticazione tramite API Express
    const verifySessionAuth = async () => {
      if (user) {
        try {
          // Verifica che la sessione sia ancora valida facendo una richiesta all'API
          const response = await apiRequest("GET", '/api/user');
          if (!response.ok) {
            console.log("Sessione scaduta o non valida, esecuzione logout");
            queryClient.setQueryData(["/api/user"], null);
            // Non chiamiamo logoutMutation perché potrebbe causare un ciclo
          }
        } catch (error) {
          console.error("Errore durante la verifica della sessione:", error);
        }
      }
    };

    // Verifica periodica dell'autenticazione (ogni 15 minuti)
    const interval = setInterval(verifySessionAuth, 15 * 60 * 1000);
    
    // Pulizia interval quando il componente viene smontato
    return () => clearInterval(interval);
  }, [user]); // Esegui quando user cambia

  const loginMutation = useMutation({
    mutationFn: async (credentials: LoginData) => {
      // Effettua login Firebase
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      const res = await apiRequest("POST", "/api/login", credentials);
      if (!res.ok) {
        // Provo a estrarre il messaggio di errore dal body, se presente
        let errorMsg = "Email o password errati";
        try {
          const data = await res.json();
          if (data && data.message) errorMsg = data.message;
        } catch {}
        throw new Error(errorMsg);
      }
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Login effettuato",
        description: `Benvenuto, ${user.email}!`,
        variant: "success",
      });
    },
    onError: async (error: Error) => {
      await apiRequest('POST', '/api/logout');
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Login fallito",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: async (credentials: InsertUser) => {
      const res = await apiRequest("POST", "/api/register", credentials);
      // Effettua login Firebase subito dopo la registrazione
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      return await res.json();
    },
    onSuccess: (user: SelectUser) => {
      queryClient.setQueryData(["/api/user"], user);
      toast({
        title: "Registrazione completata",
        description: "Account creato con successo!",
        variant: "success",
      });
      
      // Reindirizza al menu indipendentemente dal ruolo dell'utente
      window.location.href = "/menu";
    },
    onError: (error: Error) => {
      toast({
        title: "Registrazione fallita",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/logout");
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/user"], null);
      toast({
        title: "Logout effettuato",
        description: "Hai effettuato il logout con successo",
        variant: "success",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Logout fallito",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user: user ?? null,
        isLoading,
        error,
        loginMutation,
        logoutMutation,
        registerMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}