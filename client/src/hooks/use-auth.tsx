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
import { clearStoredNativePushToken, getStoredNativePushToken, unregisterNativePush } from "@/lib/native-push";
import { cleanupExpiredTokens } from "@/utils/token-cleanup";
import { clearAllProfileSummaries } from "@/pages/Profilo/utils/profileSummaryCache";
import { clearAllEncryptedProfiles, clearEncryptedProfile } from "@/pages/Profilo/utils/encryptedProfileVault";

type VerifiedPoliticalConsent = { granted: boolean; timestamp: string | null };

interface User {
  id: string;
  political_consent?: VerifiedPoliticalConsent | null;
  email: string;
  name?: string;
  nome?: string;
  cognome?: string;
  role?: string;
  ruolo?: string;
  status?: string;
  is_admin?: boolean;
  is_dpo?: boolean;
}

type AuthContextType = {
  user: User | null;
  isLoading: boolean;
  isError: boolean;
  isAuthenticated: boolean;
  isSessionVerified: boolean;
  verifiedPoliticalConsent: VerifiedPoliticalConsent | null;
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

  const { data: userData, isLoading, isError, isFetching } = useQuery<User | null>({
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
          cache: "no-store",
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (response.status === 401 || response.status === 404) {
          // A late response for an old token must never log out a newer session.
          if (getAuthToken() !== token) return null;
          clearSessionTokens();
          // Stop old authenticated GETs before the vault write barrier and wipe.
          // Do not cancel this currently executing ["user", token] query.
          const nonAuthQuery = (query: { queryKey: readonly unknown[] }) =>
            query.queryKey[0] !== "user";
          await queryClient.cancelQueries({ predicate: nonAuthQuery });
          queryClient.removeQueries({ predicate: nonAuthQuery });
          clearAllProfileSummaries();
          await clearAllEncryptedProfiles();
          setToken(null);
          return null;
        }

        if (!response.ok) {
          // The error response may contain personal data; log only the HTTP status.
          console.error("useAuth - Errore risposta /auth/me:", response.status);
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
    // A resumed app must revalidate authorization; this is the existing
    // session request, not an additional read of the user's profile panels.
    refetchOnWindowFocus: "always",
    refetchOnMount: "always",
  });

  useEffect(() => {
    if (!isLoading && userData === null && token && !getAuthToken()) {
      setToken(null);
    }
  }, [isLoading, userData, token]);

  // Fallback decoded JWT can support navigation, but never authorize local
  // political-data decryption after a failed/unfinished session validation.
  const isSessionVerified = !!userData && !isLoading && !isError && !isFetching &&
    typeof userData.political_consent?.granted === "boolean";
  const verifiedPoliticalConsent = isSessionVerified ? userData.political_consent! : null;

  // A verified revocation must delete the encrypted political snapshot,
  // not just hide it. Also reject in-flight query completions after revocation.
  useEffect(() => {
    const owner = userData?.id;
    if (!owner || !isSessionVerified || userData.political_consent?.granted !== false) return;
    // A revocation observed in /auth/me can arrive from a second device.
    // Cancel both editors AND the statistics selector before dropping RAM and
    // persistent snapshots. Disabling useQuery alone would leave old data.
    const personalToCancel = (query: { queryKey: readonly unknown[] }) =>
      ["opinioniQuestions", "statsOpinionQuestions", "profilePolitical", "profileFull"]
        .includes(String(query.queryKey[0])) && query.queryKey[1] === owner;
    void (async () => {
      await queryClient.cancelQueries({ predicate: personalToCancel });
      queryClient.removeQueries({ predicate: personalToCancel });
      await clearEncryptedProfile(owner);
    })();
  }, [userData?.id, userData?.political_consent?.granted, isSessionVerified, queryClient]);

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
      const pushTokenToRevoke = getStoredNativePushToken();

      // Finché la sessione è ancora autenticata, disattiva il token push server-side.
      if (pushTokenToRevoke && tokenToRevoke) {
        try {
          await fetch(getApiUrl(`/fcm-tokens/${encodeURIComponent(pushTokenToRevoke)}`), {
            method: "DELETE",
            headers: {
              Authorization: `Bearer ${tokenToRevoke}`,
            },
          });
        } catch (error) {
          console.warn("Impossibile disattivare il token push durante il logout:", error);
        }
      }

      await unregisterNativePush();
      clearStoredNativePushToken();
      clearSessionTokens();
      // Abort authenticated requests and erase their in-memory results before
      // wiping IndexedDB, so logout cannot leave an old account visible.
      await queryClient.cancelQueries();
      // Remove personal queries without clearing the active logout mutation;
      // its onSuccess callback still needs to complete navigation.
      queryClient.removeQueries();
      clearAllProfileSummaries();
      // Finish IndexedDB deletion before logout can navigate/reload the app.
      await clearAllEncryptedProfiles();
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
        // Il logout DEMOS deve riuscire anche se Credential Manager non riesce
        // a pulire il proprio stato locale.
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
        isSessionVerified,
        verifiedPoliticalConsent,
        logoutMutation,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
