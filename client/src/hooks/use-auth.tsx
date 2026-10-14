import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import {
  useMutation,
  useQuery,
  useQueryClient,
  UseMutationResult,
} from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { API_CONFIG, getApiUrl } from "@/lib/api-config";
import { clearSessionTokens, getAuthToken, getRefreshToken } from "@/lib/auth-token";
import { clearNativeGoogleCredentialState } from "@/lib/native-google-auth";
import { cleanupExpiredTokens } from "@/utils/token-cleanup";

interface User {
  id: string;
  email: string;
  name?: string;
  nome?: string;
  cognome?: string;
  role?: string;
  ruolo?: string;
  status?: string;
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isError: boolean;
  isAuthenticated: boolean;
  logoutMutation: UseMutationResult<void, Error, void>;
};

export const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth deve essere usato all'interno di AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(() => {
    const storedToken = getAuthToken();
    if (!storedToken) return null;

    const wasCleaned = cleanupExpiredTokens();
    return wasCleaned ? null : storedToken;
  });

  const { data: userData, isLoading, isError } = useQuery<User | null>({
    queryKey: ["user", token],
    queryFn: async () => {
      if (!token) return null;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      try {
        const response = await fetch(getApiUrl(API_CONFIG.AUTH.ME), {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 401 || response.status === 404) {
          clearSessionTokens();
          setToken(null);
          return null;
        }

        if (!response.ok) {
          console.error(
            "useAuth - Errore risposta /auth/me:",
            response.status,
            await response.text(),
          );
          return null;
        }

        const result = await response.json();
        return result.success ? result.user : null;
      } catch (error) {
        clearTimeout(timeoutId);
        if (error instanceof Error && error.name === "AbortError") {
          return null;
        }
        console.error("useAuth - Errore fetch /auth/me:", error);
        return null;
      }
    },
    enabled: !!token,
    retry: false,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (!isLoading && userData === null && token && !getAuthToken()) {
      setToken(null);
    }
  }, [isLoading, userData, token]);

  let user: User | null = userData ?? null;
  if (!user && token) {
    try {
      const payloadJson = atob(token.split(".")[1] || "");
      const payload = JSON.parse(payloadJson);
      if (payload?.userId) {
        user = {
          id: payload.userId,
          email: payload.email || "",
          ruolo: payload.role,
          role: payload.role,
          status: payload.status || "a",
        };
      }
    } catch (error) {
      console.error("useAuth - Errore nella decodifica del token JWT:", error);
    }
  }

  const logoutMutation = useMutation<void, Error, void>({
    mutationFn: async () => {
      const tokenToRevoke = token;
      const refreshTokenToRevoke = getRefreshToken();
      clearSessionTokens();
      setToken(null);

      try {
        await fetch(getApiUrl(API_CONFIG.AUTH.LOGOUT), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(tokenToRevoke ? { Authorization: `Bearer ${tokenToRevoke}` } : {}),
          },
          body: JSON.stringify({ refreshToken: refreshTokenToRevoke }),
        });
      } catch (error) {
        console.warn("Errore logout backend:", error);
      }

      try {
        await clearNativeGoogleCredentialState();
      } catch (error) {
        // Il logout DEMOS deve riuscire anche se il provider Android non riesce
        // a pulire il proprio stato; il prossimo login mostrerà comunque l'errore.
        console.warn("Errore pulizia Credential Manager Android:", error);
      }
    },
    onSuccess: () => {
      queryClient.setQueryData(["user"], null);
      queryClient.clear();
      toast({
        title: "Logout effettuato",
        description: "Alla prossima!",
        variant: "default",
      });
      window.location.href = "/";
    },
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isError,
        isAuthenticated: !!token,
        logoutMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
