import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { registerWithPasskey, getOrCreateDeviceId } from "@/lib/webauthn";
import { getApiUrl } from "@/lib/api-config";
import { API_CONFIG } from "@/lib/api-config";
import { Loader2 } from "lucide-react";

const OAUTH_FLOW_KEY = "registrazione_oauth_flow";

export default function RegistrazioneCreaPasskey() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [deviceAlreadyHasAccount, setDeviceAlreadyHasAccount] = useState<boolean | null>(null);
  const [isOauthCompleting, setIsOauthCompleting] = useState<boolean>(() =>
    typeof window !== "undefined" && window.localStorage.getItem(OAUTH_FLOW_KEY) === "1"
  );
  const [oauthCompleteError, setOauthCompleteError] = useState<string | null>(null);

  // Utenti arrivati da Google/Apple: completano la registrazione chiamando complete-registration (crea utente nel DB solo ora).
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(OAUTH_FLOW_KEY) !== "1") return;

    let cancelled = false;
    (async () => {
      const token = window.localStorage.getItem("auth_token");
      if (!token) {
        if (!cancelled) setOauthCompleteError("Sessione scaduta. Accedi di nuovo con Google/Apple.");
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
        // ignora
      }

      const privacy_policy_consent = window.localStorage.getItem("registrazione_privacy_consent") === "true";
      const terms_of_service_consent = window.localStorage.getItem("registrazione_terms_consent") === "true";
      const political_opinions_consent = window.localStorage.getItem("registrazione_political_opinions_consent") === "true";

      const url = getApiUrl("/auth/oauth/complete-registration");
      const res = await fetch(url, {
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
        setOauthCompleteError(data?.error || "Completamento registrazione non riuscito. Riprova.");
        return;
      }

      if (data.accessToken) window.localStorage.setItem("auth_token", data.accessToken);
      if (data.refreshToken) window.localStorage.setItem("refresh_token", data.refreshToken);
      if (data.user?.id) window.localStorage.setItem("webauthn_user_id", String(data.user.id));

      window.localStorage.removeItem(OAUTH_FLOW_KEY);
      window.localStorage.removeItem("registrazione_passkey_flow");
      Object.keys(window.localStorage).forEach((key) => {
        if (key.startsWith("registrazione_")) window.localStorage.removeItem(key);
      });
      window.location.href = "/preferiti";
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window !== "undefined" && window.localStorage.getItem(OAUTH_FLOW_KEY) === "1") return;
    let cancelled = false;
    const check = async () => {
      try {
        const deviceId = getOrCreateDeviceId();
        if (!deviceId) {
          setDeviceAlreadyHasAccount(false);
          return;
        }
        const res = await fetch(getApiUrl(API_CONFIG.WEBAUTHN.DEVICE_STATUS), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ deviceId }),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled && data.success === true && data.hasAccount === true) {
          setDeviceAlreadyHasAccount(true);
        } else {
          setDeviceAlreadyHasAccount(false);
        }
      } catch {
        if (!cancelled) setDeviceAlreadyHasAccount(false);
      }
    };
    check();
    return () => {
      cancelled = true;
    };
  }, []);

  const syncResidenzaToServer = async () => {
    try {
      if (typeof window === "undefined") return;
      const token = window.localStorage.getItem("auth_token");
      const rawProfile = window.localStorage.getItem("profilo_locale");
      if (!token || !rawProfile) return;

      const parsed = JSON.parse(rawProfile);
      const {
        paese_residenza,
        regione_residenza,
        provincia_residenza,
        comune_residenza,
      } = parsed || {};

      if (!paese_residenza) return;

      await fetch("/api/users/me", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          paese_residenza,
          regione_residenza,
          provincia_residenza,
          comune_residenza,
        }),
      }).catch(() => {
        // Evita di bloccare il flusso registrazione in caso di errore di rete
      });
    } catch (e) {
      // Silenzia eventuali errori non critici di sync
      console.error("Errore sync residenza su server:", e);
    }
  };

  const syncRegistrationConsentsToServer = async () => {
    try {
      if (typeof window === "undefined") return;
      const token = window.localStorage.getItem("auth_token");
      if (!token) return;

      const privacyConsent =
        window.localStorage.getItem("registrazione_privacy_consent") === "true";
      const termsConsent =
        window.localStorage.getItem("registrazione_terms_consent") === "true";
      const politicalConsent =
        window.localStorage.getItem("registrazione_political_opinions_consent") === "true";

      // Aggiorna consensi privacy/termini se presenti
      if (privacyConsent || termsConsent) {
        try {
          await fetch("/api/user/registration-consents", {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              privacy_policy_consent: privacyConsent,
              terms_of_service_consent: termsConsent,
            }),
          });
        } catch {
          // Non bloccare il flusso di registrazione in caso di errore
        }
      }

      // Se durante la registrazione l'utente ha accettato il consenso Art. 9,
      // registralo anche sul backend (con IP e user agent) usando l'endpoint dedicato.
      if (politicalConsent) {
        try {
          await fetch("/api/user/political-opinions-consent", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ consent: true }),
          });
        } catch {
          // Anche qui, non bloccare il flusso registrazione
        }
      }
    } catch (e) {
      console.error("Errore sync consensi registrazione su server:", e);
    }
  };

  const handleCreaPasskey = () => {
    setStatus("loading");
    setErrorMessage("");
    registerWithPasskey()
      .then(async (result) => {
        if (result.success) {
          setStatus("success");
          if (typeof window !== "undefined") {
            // Dopo la creazione dell'account con passkey, sincronizza i dati di residenza e i consensi sul database
            await syncResidenzaToServer();
            await syncRegistrationConsentsToServer();

            window.localStorage.removeItem("registrazione_passkey_flow");
            Object.keys(window.localStorage).forEach((key) => {
              if (key.startsWith("registrazione_")) window.localStorage.removeItem(key);
            });
            // Forza un reload completo come nel login, così il contesto auth viene ricalcolato
            setTimeout(() => {
              window.location.href = "/preferiti";
            }, 200);
          } else {
            navigate("/preferiti");
          }
        } else {
          setStatus("error");
          setErrorMessage(result.message || "Creazione passkey non riuscita.");
          // Se l'utente rifiuta la passkey (o fallisce), cancelliamo i dati di registrazione così può ripartire da zero
          if (typeof window !== "undefined") {
            window.localStorage.removeItem("registrazione_passkey_flow");
            window.localStorage.removeItem("profilo_locale");
            Object.keys(window.localStorage).forEach((key) => {
              if (key.startsWith("registrazione_")) window.localStorage.removeItem(key);
            });
          }
        }
      })
      .catch((err) => {
        setStatus("error");
        setErrorMessage(err?.message || "Errore imprevisto.");
        if (typeof window !== "undefined") {
          window.localStorage.removeItem("registrazione_passkey_flow");
          window.localStorage.removeItem("profilo_locale");
          Object.keys(window.localStorage).forEach((key) => {
            if (key.startsWith("registrazione_")) window.localStorage.removeItem(key);
          });
        }
      });
  };

  if (isOauthCompleting) {
    return (
      <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          {oauthCompleteError ? (
            <>
              <h1 className="text-xl font-bold text-gray-900 mb-2">Errore</h1>
              <p className="text-gray-600 mb-4">{oauthCompleteError}</p>
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
              <h1 className="text-xl font-bold text-gray-900 mb-2">Registrazione completata</h1>
              <p className="text-gray-600">Stai per essere reindirizzato...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Registrazione</h1>
        {status === "idle" && deviceAlreadyHasAccount === true && (
          <>
            <p className="text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-4 mb-6 text-left">
              In questo browser risulta già un account Demos. Accedi con la passkey esistente oppure usa un altro metodo di accesso.
            </p>
            <Button
              onClick={() => navigate("/auth")}
              className="w-full h-14 text-xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg"
            >
              Vai ad Accedi
            </Button>
          </>
        )}
        {status === "idle" && deviceAlreadyHasAccount === false && (
          <>
            <p className="text-gray-600 mb-6">Crea il tuo accesso sicuro con passkey (Face ID, impronta o PIN).</p>
            <Button
              onClick={handleCreaPasskey}
              className="w-full h-14 text-xl font-bold bg-linear-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg hover:shadow-xl transition-shadow"
            >
              Crea accesso con passkey
            </Button>
          </>
        )}
        {status === "idle" && deviceAlreadyHasAccount === null && (
          <>
            <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Controllo browser...</p>
          </>
        )}
        {status === "loading" && (
          <>
            <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
            <p className="text-gray-600">Creazione accesso con passkey in corso...</p>
            <p className="text-sm text-gray-500 mt-2">Usa Face ID, impronta o PIN del dispositivo.</p>
          </>
        )}
        {status === "error" && (
          <>
            <p className="text-red-600 font-medium mb-4">{errorMessage}</p>
            <Button onClick={() => navigate("/auth")} variant="outline" className="mr-2">
              Torna ad Accedi
            </Button>
            <Button onClick={() => { setStatus("idle"); setErrorMessage(""); }}>
              Riprova
            </Button>
            <p className="text-sm text-gray-500 mt-4">I dati di registrazione sono stati cancellati. Per ricominciare usa &quot;Torna ad Accedi&quot;.</p>
          </>
        )}
        {status !== "error" && (
          <div className="mt-8">
            <Button
              variant="ghost"
              onClick={() => {
                const isPasskeyFlow = typeof window !== "undefined" && window.localStorage.getItem("registrazione_passkey_flow");
                navigate(isPasskeyFlow ? "/registrazione-consensi?step=10" : "/registrazione-3-residenza");
              }}
              className="text-gray-500"
              disabled={status === "loading"}
            >
              ← Indietro
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
