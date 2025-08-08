import { createContext, ReactNode, useContext, useEffect } from "react";
import {
  useQuery,
  useMutation,
  UseMutationResult,
} from "@tanstack/react-query";
import { InsertUser, SelectUser } from "@shared/schema"; // Assumo che questo percorso sia corretto
import { apiRequest, getQueryFn, queryClient } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthReady } from "@/hooks/use-auth-ready";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<any, Error, InsertUser>; // Tipo di ritorno cambiato in 'any'
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
  } = useQuery<SelectUser | null, Error>({
    queryKey: ["/api/users/me"], // Endpoint corretto
    queryFn: getQueryFn({ on401: "returnNull" }),
    enabled: authReady,
    retry: false, // Non riprovare se ricevi 404 (utente non loggato)
  });

  const loginMutation = useMutation<SelectUser, Error, LoginData>({
    mutationFn: async (credentials) => {
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      // Dopo il login su Firebase, recuperiamo i dati dal nostro DB
      const res = await apiRequest("GET", "/api/users/me");
      if (!res.ok) {
        throw new Error("Utente non trovato o non approvato nel nostro database.");
      }
      return res.json();
    },
    onSuccess: (user) => {
      queryClient.setQueryData(["/api/users/me"], user);
      toast({ title: "Login effettuato", description: `Benvenuto, ${user.nome}!`, variant: "success" });
    },
    onError: async (error: Error) => {
      await signOut(auth); // Se il login sul nostro DB fallisce, fai logout anche da Firebase
      queryClient.setQueryData(["/api/users/me"], null);
      toast({ title: "Login fallito", description: error.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation<any, Error, InsertUser>({
    mutationFn: (credentials) => apiRequest("POST", "/api/users/register", credentials),
    onSuccess: () => {
      toast({
        title: "Registrazione Inviata!",
        description: "La tua richiesta è in attesa di approvazione da un amministratore.",
        variant: "success",
        duration: 10000,
      });
      setTimeout(() => {
        window.location.href = "/auth";
      }, 5000);
    },
    onError: (error: Error) => {
      toast({ title: "Registrazione fallita", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      // Non c'è bisogno di una chiamata API per il logout se usiamo i token di Firebase
      await signOut(auth);
    },
    onSuccess: () => {
      queryClient.setQueryData(["/api/users/me"], null);
      toast({ title: "Logout effettuato", variant: "success" });
    },
    onError: (error: Error) => {
      toast({ title: "Logout fallito", description: error.message, variant: "destructive" });
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