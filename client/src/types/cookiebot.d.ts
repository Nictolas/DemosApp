declare global {
  interface Window {
    Cookiebot?: {
      consent: {
        necessary: boolean;
        preferences: boolean;
        statistics: boolean;
        marketing: boolean;
      };
      show: () => void;
      hide: () => void;
      renew: () => void;
    };
    adsbygoogle?: any[];
  }
}

export {};
