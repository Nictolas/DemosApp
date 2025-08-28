import { useState, useEffect } from 'react';

interface CookieConsent {
  necessary: boolean;
  preferences: boolean;
  statistics: boolean;
  marketing: boolean;
}

export function useCookieConsent() {
  const [consent, setConsent] = useState<CookieConsent | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const checkCookiebot = () => {
      if (window.Cookiebot && window.Cookiebot.consent) {
        setConsent(window.Cookiebot.consent);
        setIsReady(true);
      } else {
        // Se Cookiebot non è ancora caricato, riprova dopo un breve delay
        setTimeout(checkCookiebot, 100);
      }
    };

    checkCookiebot();
  }, []);

  const hasConsent = (category: keyof CookieConsent) => {
    return consent?.[category] || false;
  };

  const showConsentBanner = () => {
    if (window.Cookiebot) {
      window.Cookiebot.show();
    }
  };

  const hideConsentBanner = () => {
    if (window.Cookiebot) {
      window.Cookiebot.hide();
    }
  };

  const renewConsent = () => {
    if (window.Cookiebot) {
      window.Cookiebot.renew();
    }
  };

  return {
    consent,
    isReady,
    hasConsent,
    showConsentBanner,
    hideConsentBanner,
    renewConsent
  };
}
