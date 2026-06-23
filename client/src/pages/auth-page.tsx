import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { Redirect, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2 } from "lucide-react";
import appIcon from "/icona.png";
import './auth-page.css';
import { isWebAuthnSupported, loginWithPasskey, hasLocalPasskeyFlag, getOrCreateDeviceId } from "@/lib/webauthn";
import { getApiUrl, API_CONFIG } from "@/lib/api-config";
import { getGoogleClientId, getAppleClientId, loginWithGoogle, loginWithApple, isIOSOrMobileSafari, loginWithGoogleRedirect, handleGoogleRedirectCallback } from "@/lib/oauth";

export default function AuthPage() {
  const [location, navigate] = useLocation();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();

  const [isWebAuthnAvailable, setIsWebAuthnAvailable] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  // Verifica supporto Passkeys/WebAuthn
  useEffect(() => {
    setIsWebAuthnAvailable(isWebAuthnSupported());
  }, []);

  // Ritorno da redirect Google (iOS/Safari): leggi id_token dall'hash e completa il login
  useEffect(() => {
    if (!getGoogleClientId() || location !== "/auth") return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash || !hash.includes("id_token=")) return;
    handleGoogleRedirectCallback().then((result) => {
      if (!result) return;
      setOauthLoading("google");
      if (result.success) {
        if (result.isNew === false) {
          toast({ title: "Login effettuato", description: "Accesso con Google completato." });
          window.location.href = "/preferiti";
        } else {
          toast({ title: "Benvenuto", description: "Completa la registrazione." });
          localStorage.setItem("registrazione_oauth_flow", "1");
          navigate("/registrazione-consensi");
        }
      } else {
        toast({ title: "Accesso non completato", description: result.message || "Errore con Google.", variant: "destructive" });
      }
      setOauthLoading(null);
    });
  }, [location, navigate, toast]);

  /** Flusso passkey (secondario): login se esiste, altrimenti registrazione. */
  const handlePasskey = async () => {
    // Mostra subito feedback sul click
    setIsPasskeyLoading(true);

    if (!isWebAuthnAvailable) {
      toast({
        title: "Passkey non supportata",
        description: "Il tuo browser o dispositivo non supporta ancora le passkey. Per motivi di sicurezza non è più possibile registrarsi con email e password da questo dispositivo.",
        variant: "destructive",
      });
      setIsPasskeyLoading(false);
      return;
    }

    try {
      const hadLocalPasskeyFlag = hasLocalPasskeyFlag();

      // 1) Se il dispositivo non ha mai usato una passkey Demos, controlla lato server
      //    se esiste già un account passkey associato al deviceId. Se NO → vai subito a registrazione.
      if (!hadLocalPasskeyFlag) {
        try {
          const deviceId = getOrCreateDeviceId();
          if (deviceId) {
            const res = await fetch(getApiUrl(API_CONFIG.WEBAUTHN.DEVICE_STATUS), {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deviceId }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.success === true && data.hasAccount === false) {
              // Nessun account passkey per questo dispositivo: avvia direttamente il flusso di registrazione
              localStorage.setItem("registrazione_passkey_flow", "1");
              navigate("/registrazione-consensi");
              return;
            }
          }
        } catch {
          // In caso di errore di rete, proseguiamo comunque con il loginWithPasskey
        }
      }

      // 2) Prova login con passkey
      const result = await loginWithPasskey();
      if (result.success) {
        toast({
          title: "Login effettuato",
          description: "Accesso effettuato. Ti reindirizziamo.",
        });
        setTimeout(() => { window.location.href = '/preferiti'; }, 200);
        return;
      }
      toast({
        title: "Accesso non completato",
        description: result.message || "Impossibile accedere con passkey.",
        variant: "destructive",
      });
      // Se l'utente annulla il prompt:
      // - se il dispositivo non ha mai usato una passkey Demos, avvia la registrazione
      // - altrimenti resta sulla pagina di login
      if (result.code === "CANCELLED") {
        if (!hadLocalPasskeyFlag) {
          localStorage.setItem("registrazione_passkey_flow", "1");
          navigate("/registrazione-consensi");
        }
        return;
      }
      // Avvia registrazione quando il server segnala che non esiste nessuna passkey valida
      if (result.code === "PASSKEY_NOT_FOUND") {
        localStorage.setItem("registrazione_passkey_flow", "1");
        navigate("/registrazione-consensi");
      }
      // Negli altri casi (errore tecnico, verifica fallita) resta sulla pagina di login
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    // Su iPhone/Safari il One Tap non completa: usa redirect a Google
    if (isIOSOrMobileSafari()) {
      setOauthLoading("google");
      loginWithGoogleRedirect();
      return;
    }
    setOauthLoading("google");
    try {
      const result = await loginWithGoogle();
      if (result.success) {
        // isNew === true o undefined → primo accesso: wizard. Solo isNew === false → utente già esistente → Preferiti.
        if (result.isNew === false) {
          toast({ title: "Login effettuato", description: "Accesso con Google completato." });
          setTimeout(() => { window.location.href = "/preferiti"; }, 200);
        } else {
          toast({ title: "Benvenuto", description: "Completa la registrazione." });
          localStorage.setItem("registrazione_oauth_flow", "1");
          navigate("/registrazione-consensi");
        }
      } else {
        toast({ title: "Accesso non completato", description: result.message || "Errore con Google.", variant: "destructive" });
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    setOauthLoading("apple");
    try {
      const result = await loginWithApple();
      if (result.success) {
        if (result.isNew === false) {
          toast({ title: "Login effettuato", description: "Accesso con Apple completato." });
          setTimeout(() => { window.location.href = "/preferiti"; }, 200);
        } else {
          toast({ title: "Benvenuto", description: "Completa la registrazione." });
          localStorage.setItem("registrazione_oauth_flow", "1");
          navigate("/registrazione-consensi");
        }
      } else {
        toast({ title: "Accesso non completato", description: result.message || "Errore con Apple.", variant: "destructive" });
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const showGoogle = !!getGoogleClientId();
  const showApple = !!getAppleClientId();
  const showOAuth = showGoogle || showApple;
  const oauthBusy = oauthLoading !== null;

  // Se l'utente è già autenticato, reindirizza alla home
  if (user && !isLoading) {
    return <Redirect to="/preferiti" />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 p-4">
      <Card className="w-full max-w-md shadow-xl bg-white">
        <CardHeader className="text-center space-y-4">
          <div className="flex flex-col items-center">
            <img
              src={appIcon}
              alt="Logo Demos"
              className="w-20 h-20 mb-2"
            />
            <h1 className="text-3xl font-extrabold tracking-tight">
              <span className="bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                DEMOS
              </span>
            </h1>
          </div>
          <div className="space-y-1">
            <CardTitle className="text-2xl font-bold text-gray-800">
              Benvenuto su Demos
            </CardTitle>
            <CardDescription className="text-center text-gray-600">
              Demos è un sistema operativo per la Democrazia, una piattaforma che collega elettori e rappresentanti politici.
            </CardDescription>
            <p className="text-xs text-gray-500">
              Registrati o accedi per continuare e usare tutte le funzionalità.
            </p>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {showGoogle && (
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="w-full h-14 text-base font-semibold border-gray-300 bg-white hover:bg-gray-50 shadow-sm"
              disabled={oauthBusy || isPasskeyLoading}
              onClick={handleGoogleLogin}
            >
              {oauthLoading === "google" ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Continua con Google
            </Button>
          )}

          {showApple && (
            <Button
              type="button"
              size="lg"
              className="w-full h-14 text-base font-semibold bg-black hover:bg-gray-900 text-white"
              disabled={oauthBusy || isPasskeyLoading}
              onClick={handleAppleLogin}
            >
              {oauthLoading === "apple" ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
                </svg>
              )}
              Continua con Apple
            </Button>
          )}

          {showOAuth && (
            <div className="relative py-1">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-gray-200" />
              </div>
              <div className="relative flex justify-center text-xs uppercase text-gray-500">
                <span className="bg-white px-2">oppure</span>
              </div>
            </div>
          )}

          <div className="text-center space-y-2 pt-1">
            <button
              type="button"
              className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline disabled:opacity-50 disabled:no-underline"
              disabled={oauthBusy || isPasskeyLoading}
              onClick={handlePasskey}
            >
              {isPasskeyLoading ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Verifica in corso...
                </span>
              ) : showOAuth ? (
                "Non ho Google o Apple — usa passkey su questo dispositivo"
              ) : (
                "Usa passkey su questo dispositivo"
              )}
            </button>
            <p className="text-xs text-gray-500 leading-relaxed px-2">
              {showOAuth
                ? "La passkey lega l'account a questo telefono o browser. Senza Google o Apple non potrai recuperarlo se cambi dispositivo."
                : "L'accesso con passkey resta legato a questo telefono o browser."}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
