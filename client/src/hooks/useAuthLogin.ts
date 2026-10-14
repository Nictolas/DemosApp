import { useState, useEffect } from "react";
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
import { isWebAuthnSupported, loginWithPasskey } from "@/lib/webauthn";

const AUTH_ROUTES = ["/", "/auth"];

type AuthMethod = "google" | "apple" | "passkey";

export function useAuthLogin() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const [oauthLoading, setOauthLoading] = useState<AuthMethod | null>(null);
  const [oauthConfigLoading, setOauthConfigLoading] = useState(true);
  const [, setOauthConfigRevision] = useState(0);

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
    if (oauthConfigLoading || !getGoogleClientId() || !AUTH_ROUTES.includes(location)) return;
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
        toast({
          title: "Accesso non completato",
          description: result.message || "Errore con Google.",
          variant: "destructive",
        });
      }
      setOauthLoading(null);
    });
  }, [location, navigate, oauthConfigLoading, toast]);

  const handleGoogleLogin = async () => {
    await loadOAuthConfig();
    if (isIOSOrMobileSafari()) {
      setOauthLoading("google");
      loginWithGoogleRedirect();
      return;
    }
    setOauthLoading("google");
    try {
      const result = await loginWithGoogle();
      if (result.success) {
        if (result.isNew === false) {
          toast({ title: "Login effettuato", description: "Accesso con Google completato." });
          setTimeout(() => {
            window.location.href = "/preferiti";
          }, 200);
        } else {
          toast({ title: "Benvenuto", description: "Completa la registrazione." });
          localStorage.setItem("registrazione_oauth_flow", "1");
          navigate("/registrazione-consensi");
        }
      } else {
        toast({
          title: "Accesso non completato",
          description: result.message || "Errore con Google.",
          variant: "destructive",
        });
      }
    } finally {
      setOauthLoading(null);
    }
  };

  const handleAppleLogin = async () => {
    await loadOAuthConfig();
    setOauthLoading("apple");
    try {
      const result = await loginWithApple();
      if (result.success) {
        if (result.isNew === false) {
          toast({ title: "Login effettuato", description: "Accesso con Apple completato." });
          setTimeout(() => {
            window.location.href = "/preferiti";
          }, 200);
        } else {
          toast({ title: "Benvenuto", description: "Completa la registrazione." });
          localStorage.setItem("registrazione_oauth_flow", "1");
          navigate("/registrazione-consensi");
        }
      } else {
        toast({
          title: "Accesso non completato",
          description: result.message || "Errore con Apple.",
          variant: "destructive",
        });
      }
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

  const showGoogle = !!getGoogleClientId();
  const showApple = !!getAppleClientId();
  const showPasskey = isWebAuthnSupported();
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
