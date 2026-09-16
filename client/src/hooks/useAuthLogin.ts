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

// Nome legacy: oggi questa chiave viene valorizzata anche dai login OAuth riusciti
// e quindi può essere usata come indicatore locale di un account Demos già associato.
const LOCAL_ACCOUNT_ID_KEY = "webauthn_user_id";

function hasLocalAccountBinding(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const value = window.localStorage.getItem(LOCAL_ACCOUNT_ID_KEY);
    return typeof value === "string" && value.trim().length > 0;
  } catch {
    return false;
  }
}

export function useAuthLogin() {
  const [location, navigate] = useLocation();
  const { toast } = useToast();

  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  const blockDuplicateRegistrationOnThisDevice = (): boolean => {
    if (!hasLocalAccountBinding()) return false;

    toast({
      title: "Account Demos già presente",
      description:
        "Questo dispositivo o browser risulta già associato a un account Demos. Per evitare account multipli, usa l'account già esistente. In seguito potrai collegare più metodi di accesso allo stesso profilo.",
      variant: "destructive",
    });
    return true;
  };

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
          if (blockDuplicateRegistrationOnThisDevice()) {
            setOauthLoading(null);
            return;
          }
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
          if (blockDuplicateRegistrationOnThisDevice()) return;
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
          if (blockDuplicateRegistrationOnThisDevice()) return;
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
