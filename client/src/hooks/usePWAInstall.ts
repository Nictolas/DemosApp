import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // Verifica se l'app è già installata
    const checkIfInstalled = () => {
      // Controlla se l'app è in modalità standalone (installata)
      if (window.matchMedia('(display-mode: standalone)').matches) {
        setIsInstalled(true);
        return;
      }
      
      // Controlla se l'app è stata aggiunta alla schermata home su iOS
      if ((window.navigator as any).standalone === true) {
        setIsInstalled(true);
        return;
      }
    };

    // Gestisce l'evento beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      const event = e as BeforeInstallPromptEvent;
      setDeferredPrompt(event);
      setIsInstallable(true);
    };

    // Gestisce l'evento appinstalled
    const handleAppInstalled = () => {
      setIsInstalled(true);
      setIsInstallable(false);
      setDeferredPrompt(null);
    };

    // Verifica iniziale
    checkIfInstalled();

    // Aggiunge i listener per gli eventi
    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    // Cleanup
    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) {
      return false;
    }

    try {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setIsInstallable(false);
        setDeferredPrompt(null);
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Errore durante l\'installazione:', error);
      return false;
    }
  };

  const showInstallInstructions = () => {
    const userAgent = navigator.userAgent.toLowerCase();
    const isIOS = /iphone|ipad|ipod/.test(userAgent);
    const isAndroid = /android/.test(userAgent);
    const isSafari = /safari/.test(userAgent) && !/chrome/.test(userAgent);

    if (isIOS && isSafari) {
      // Istruzioni per iOS Safari
      alert(
        'Per aggiungere DEMOS alla schermata home:\n\n' +
        '1. Tocca il pulsante Condividi (quadrato con freccia)\n' +
        '2. Scorri verso il basso e tocca "Aggiungi a Home"\n' +
        '3. Tocca "Aggiungi" in alto a destra'
      );
    } else if (isAndroid) {
      // Istruzioni per Android
      alert(
        'Per aggiungere DEMOS alla schermata home:\n\n' +
        '1. Tocca il menu del browser (tre punti)\n' +
        '2. Seleziona "Aggiungi alla schermata Home" o "Installa app"\n' +
        '3. Conferma l\'installazione'
      );
    } else {
      // Istruzioni generiche
      alert(
        'Per aggiungere DEMOS alla schermata home:\n\n' +
        '1. Cerca l\'opzione "Installa" o "Aggiungi alla schermata Home" nel menu del browser\n' +
        '2. Segui le istruzioni per completare l\'installazione'
      );
    }
  };

  return {
    isInstallable,
    isInstalled,
    installApp,
    showInstallInstructions
  };
}
