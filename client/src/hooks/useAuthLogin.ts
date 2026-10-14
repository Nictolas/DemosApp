import { useState, useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  getGoogleClientId,
  getAppleClientId,
  loadOAuthConfig,
  loginWithGoogle,
  loginWithApple,
  isIOSOrMobileSafari,
  loginWithGoogleRedirect,
  handleGoogleRedirectCallback,
} from "@/lib/oauth";
import { isNativeAndroid, loginWithNativeGoogle } from "@/lib/native-google-auth";
import { isWebAuthnSupported, loginWithPasskey } from "@/lib/webauthn";

const AUTH_ROUTES = ["/", "/auth"];

type AuthMethod = "google" | "apple" | "passkey";
type AuthResult = { success: boolean; message?: string; isNew?: boolean };

export function useAuthLogin() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const [oauthLoading, setOauthLoading] = useState<AuthMethod | null>(null);
  const [oauthConfigLoading, setOauthConfigLoading] = useState(true);
  const [, setOauthConfigRevision] = useState(0);

  const finishOAuthLogin = (provider: "Google" | "Apple", result: AuthResult) => {
    if (!result.success) {
      toast({
        title: "Accesso non completato",
        description: result.message || `Errore con ${provider}.`,
        variant: "destructive",
      });
      return;
    }

    if (result.isNew === false) {
      toast({ title: "Login effettuato", description: `Accesso con ${provider} completato.` });
      setTimeout(() => {
        window.location.href = "/preferiti";
      }, 200);
      return;
    }

    toast({ title: "Benvenuto", description: "Completa la registrazione." });
    localStorage.setItem("registrazione_oauth_flow", "1");
    navigate("/registrazione-consensi");
  };

  useEffect(() => {
    let active = true;
    loadOAuthConfig().finally(() => {
      if (!active) return;
      setOauthConfigLoading(false);
      setOauthConfigRevision((value) => value + 1);
    });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Il callback hash riguarda solo il flusso web/iOS. Android usa Credential Manager.
    if (isNativeAndroid()) return;
    if (oauthConfigLoading || !getGoogleClientId() || !AUTH_ROUTES.includes(location)) return;
    const hash = typeof window !== "undefined" ? window.location.hash : "";
    if (!hash || !hash.includes("id_token=")) return;

    handleGoogleRedirectCallback().then((result) => {
      if (!result) return;
      setOauthLoading("google");
      finishOAuthLogin("Google", result);
      setOauthLoading(null);
    });
  }, [location, oauthConfigLoading]);

  const handleGoogleLogin = async () => {
    setOauthLoading("google");
    try {
      await loadOAuthConfig();
      const clientId = getGoogleClientId();
      if (!clientId) {
        finishOAuthLogin("Google", { success: false, message: "Google OAuth non configurato." });
        return;
      }

      if (isNativeAndroid()) {
        const result = await loginWithNativeGoogle(clientId);
        finishOAuthLogin("Google", result);
        return;
      }

      if (isIOSOrMobileSafari()) {
        // Su iOS/Safari il flusso web esistente usa redirect esterno.
        loginWithGoogleRedirect();
        return;
      }

      const result = await loginWithGoogle();
      finishOAuthLogin("Google", result);
    } catch (error: any) {
      finishOAuthLogin("Google", {
        success: false,
        message: error?.message || "Accesso con Google non riuscito.",
      });
    } finally {
      // Nel redirect iOS la pagina sta navigando via; negli altri casi chiudiamo lo spinner.
      if (!isIOSOrMobileSafari() || isNativeAndroid()) setOauthLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    await loadOAuthConfig();
    setOauthLoading("apple");
    try {
      const result = await loginWithApple();
      finishOAuthLogin("Apple", result);
    } catch (error: any) {
      finishOAuthLogin("Apple", {
        success: false,
        message: error?.message || "Accesso con Apple non riuscito.",
      });
    } finally {
      setOauthLoading(null);
    }
  };

  const handlePasskeyLogin = async () => {
    setOauthLoading("passkey");
    try {
      const result = await loginWithPasskey();
      if (result.success) {
        toast({ title: "Login effettuato", description: "Accesso con passkey completato." });
        setTimeout(() => {
          window.location.href = "/preferiti";
        }, 200);
      } else if (result.code !== "CANCELLED") {
        toast({
          title: "Accesso non completato",
          description: result.message || "Errore con la passkey.",
          variant: "destructive",
        });
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const nativeAndroid = isNativeAndroid();
  const nativePlatform = Capacitor.isNativePlatform();
  const showGoogle = !!getGoogleClientId();
  // Apple JS e WebAuthn in WebView richiedono un gate nativo dedicato: non mostrarli
  // su Android finché non sono qualificati. Google resta il percorso nativo supportato.
  const showApple = !!getAppleClientId() && !nativeAndroid;
  const showPasskey = isWebAuthnSupported() && !nativePlatform;
  const showOAuth = showGoogle || showApple;
  const showAnyAuth = showOAuth || showPasskey;
  const oauthBusy = oauthLoading !== null;

  return {
    oauthLoading,
    oauthConfigLoading,
    showGoogle,
    showApple,
    showPasskey,
    showOAuth,
    showAnyAuth,
    oauthBusy,
    handleGoogleLogin,
    handleAppleLogin,
    handlePasskeyLogin,
  };
}
