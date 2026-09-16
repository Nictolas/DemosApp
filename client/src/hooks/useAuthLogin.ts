import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import {
  getGoogleClientId,
  getAppleClientId,
  loginWithGoogle,
  loginWithApple,
  isIOSOrMobileSafari,
  loginWithGoogleRedirect,
  handleGoogleRedirectCallback,
} from "@/lib/oauth";

const AUTH_ROUTES = ["/", "/auth"];

export function useAuthLogin() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  useEffect(() => {
    if (!getGoogleClientId() || !AUTH_ROUTES.includes(location)) return;
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
  }, [location, navigate, toast]);

  const handleGoogleLogin = async () => {
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

  const showGoogle = !!getGoogleClientId();
  const showApple = !!getAppleClientId();
  const showOAuth = showGoogle || showApple;
  const oauthBusy = oauthLoading !== null;

  return {
    oauthLoading,
    showGoogle,
    showApple,
    showOAuth,
    oauthBusy,
    handleGoogleLogin,
    handleAppleLogin,
  };
}
