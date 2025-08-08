import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation, UseMutationResult, queryClient } from "@tanstack/react-query";
import { InsertUser, SelectUser } from "@shared/schema";
import { apiRequest, getQueryFn } from "../lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";
import { useAuthReady } from "@/hooks/use-auth-ready";

type AuthContextType = {
  user: SelectUser | null;
  isLoading: boolean;
  loginMutation: UseMutationResult<SelectUser, Error, LoginData>;
  logoutMutation: UseMutationResult<void, Error, void>;
  registerMutation: UseMutationResult<any, Error, InsertUser>;
};
type LoginData = Pick<InsertUser, "email" | "password">;

export const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const authReady = useAuthReady();

  const { data: user, isLoading } = useQuery<SelectUser | null>({
    queryKey: ['user'],
    queryFn: async () => {
      if (!auth.currentUser) return null;
      const response = await apiRequest("GET", "/api/users/me");
      if (response.status === 404 || response.status === 401) return null;
      if (!response.ok) throw new Error("Failed to fetch user");
      return response.json();
    },
    enabled: authReady,
    retry: false,
  });

  const loginMutation = useMutation<SelectUser, Error, LoginData>({
    mutationFn: async (credentials) => {
      await signInWithEmailAndPassword(auth, credentials.email, credentials.password);
      const response = await apiRequest("POST", "/api/users/login"); // Chiama la nuova rotta di login
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || "Login fallito");
      }
      return response.json();
    },
    onSuccess: (data) => {
      queryClient.setQueryData(['user'], data);
      toast({ title: "Login effettuato!", variant: "success" });
    },
    onError: async (error) => {
      await signOut(auth);
      queryClient.setQueryData(['user'], null);
      toast({ title: "Login fallito", description: error.message, variant: "destructive" });
    },
  });

  const registerMutation = useMutation<any, Error, InsertUser>({
    mutationFn: (credentials) => apiRequest("POST", "/api/users/register", credentials),
    onSuccess: () => {
      toast({
        title: "Registrazione Inviata!",
        description: "La tua richiesta è in attesa di approvazione.",
        variant: "success",
        duration: 10000,
      });
      setTimeout(() => window.location.href = "/auth", 5000);
    },
    onError: (error) => {
      toast({ title: "Registrazione fallita", description: error.message, variant: "destructive" });
    },
  });

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: () => signOut(auth),
    onSuccess: () => {
      queryClient.setQueryData(['user'], null);
    },
  });

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, loginMutation, logoutMutation, registerMutation }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}