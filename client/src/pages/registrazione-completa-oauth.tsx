import React, { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { getApiUrl } from "@/lib/api-config";
import { Loader2 } from "lucide-react";

const OAUTH_FLOW_KEY = "registrazione_oauth_flow";

export default function RegistrazioneCompletaOAuth() {
  const [, navigate] = useLocation();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    if (window.localStorage.getItem(OAUTH_FLOW_KEY) !== "1") {
      navigate("/auth");
      return;
    }

    let cancelled = false;

    const completeRegistration = async () => {
      try {
        const token = window.localStorage.getItem("auth_token");
        if (!token) {
          if (!cancelled) {
            setErrorMessage("Sessione scaduta. Accedi di nuovo con Google/Apple.");
          }
          return;
        }

        let paese_residenza: string | null = null;
        let regione_residenza: string | null = null;
        let provincia_residenza: string | null = null;
        let comune_residenza: string | null = null;

        try {
          const rawProfile = window.localStorage.getItem("profilo_locale");
          if (rawProfile) {
            const parsed = JSON.parse(rawProfile);
            paese_residenza = parsed?.paese_residenza ?? null;
            regione_residenza = parsed?.regione_residenza ?? null;
            provincia_residenza = parsed?.provincia_residenza ?? null;
            comune_residenza = parsed?.comune_residenza ?? null;
          }
        } catch {
          // Un profilo locale non valido non deve interrompere il completamento OAuth.
        }

        const privacy_policy_consent =
          window.localStorage.getItem("registrazione_privacy_consent") === "true";
        const terms_of_service_consent =
          window.localStorage.getItem("registrazione_terms_consent") === "true";
        const political_opinions_consent =
          window.localStorage.getItem("registrazione_political_opinions_consent") === "true";

        const res = await fetch(getApiUrl("/auth/oauth/complete-registration"), {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            paese_residenza,
            regione_residenza,
            provincia_residenza,
            comune_residenza,
            privacy_policy_consent,
            terms_of_service_consent,
            political_opinions_consent,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (cancelled) return;

        if (!res.ok || !data.success) {
          setErrorMessage(data?.error || "Completamento registrazione non riuscito. Riprova.");
          return;
        }

        if (data.accessToken) window.localStorage.setItem("auth_token", data.accessToken);
        if (data.refreshToken) window.localStorage.setItem("refresh_token", data.refreshToken);
        if (data.user?.id) {
          // Compatibilità temporanea: questa chiave verrà migrata a demos_account_id
          // dalla pulizia dedicata dell'account storage.
          window.localStorage.setItem("webauthn_user_id", String(data.user.id));
        }

        window.localStorage.removeItem(OAUTH_FLOW_KEY);
        window.localStorage.removeItem("registrazione_passkey_flow");
        Object.keys(window.localStorage).forEach((key) => {
          if (key.startsWith("registrazione_")) window.localStorage.removeItem(key);
        });

        window.location.href = "/preferiti";
      } catch {
        if (!cancelled) {
          setErrorMessage("Errore di rete durante il completamento della registrazione. Riprova.");
        }
      }
    };

    completeRegistration();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {errorMessage ? (
          <>
            <h1 className="text-xl font-bold text-gray-900 mb-2">Errore</h1>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <Button
              onClick={() => {
                window.localStorage.removeItem(OAUTH_FLOW_KEY);
                window.location.href = "/auth";
              }}
              className="w-full"
            >
              Torna ad Accedi
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2">Completamento registrazione</h1>
            <p className="text-gray-600">Stiamo completando il tuo account Demos...</p>
          </>
        )}
      </div>
    </div>
  );
}
