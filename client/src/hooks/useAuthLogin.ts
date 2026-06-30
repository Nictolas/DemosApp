import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { isWebAuthnSupported, loginWithPasskey, hasLocalPasskeyFlag, getOrCreateDeviceId } from "@/lib/webauthn";
import { getApiUrl, API_CONFIG } from "@/lib/api-config";
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

  const [isWebAuthnAvailable, setIsWebAuthnAvailable] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<"google" | "apple" | null>(null);

  useEffect(() => {
    setIsWebAuthnAvailable(isWebAuthnSupported());
  }, []);

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

  const handlePasskey = async () => {
    setIsPasskeyLoading(true);

    if (!isWebAuthnAvailable) {
      toast({
        title: "Passkey non supportata",
        description:
          "Il tuo browser o dispositivo non supporta ancora le passkey. Per motivi di sicurezza non è più possibile registrarsi con email e password da questo dispositivo.",
        variant: "destructive",
      });
      setIsPasskeyLoading(false);
      return;
    }

    try {
      const hadLocalPasskeyFlag = hasLocalPasskeyFlag();

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
              localStorage.setItem("registrazione_passkey_flow", "1");
              navigate("/registrazione-consensi");
              return;
            }
          }
        } catch {
          // In caso di errore di rete, proseguiamo comunque con il loginWithPasskey
        }
      }

      const result = await loginWithPasskey();
      if (result.success) {
        toast({
          title: "Login effettuato",
          description: "Accesso effettuato. Ti reindirizziamo.",
        });
        setTimeout(() => {
          window.location.href = "/preferiti";
        }, 200);
        return;
      }
      toast({
        title: "Accesso non completato",
        description: result.message || "Impossibile accedere con passkey.",
        variant: "destructive",
      });
      if (result.code === "CANCELLED") {
        if (!hadLocalPasskeyFlag) {
          localStorage.setItem("registrazione_passkey_flow", "1");
          navigate("/registrazione-consensi");
        }
        return;
      }
      if (result.code === "PASSKEY_NOT_FOUND") {
        localStorage.setItem("registrazione_passkey_flow", "1");
        navigate("/registrazione-consensi");
      }
    } finally {
      setIsPasskeyLoading(false);
    }
  };

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
    isPasskeyLoading,
    oauthLoading,
    showGoogle,
    showApple,
    showOAuth,
    oauthBusy,
    handlePasskey,
    handleGoogleLogin,
    handleAppleLogin,
  };
}
