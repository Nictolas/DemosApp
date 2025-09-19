import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Download, Smartphone } from 'lucide-react';
import { usePWAInstall } from '@/hooks/usePWAInstall';

export function PWAInstallBanner() {
  const { isInstallable, isInstalled, isMobile, installApp, showInstallInstructions } = usePWAInstall();
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Mostra il banner solo su dispositivi mobili, se l'app non è installata e non è stata già chiusa
    if (isMobile && !isInstalled && !isDismissed) {
      // Mostra il banner dopo un piccolo delay per una migliore UX
      const timer = setTimeout(() => {
        setIsVisible(true);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [isMobile, isInstalled, isDismissed]);

  const handleInstall = async () => {
    if (isInstallable) {
      const success = await installApp();
      if (success) {
        setIsVisible(false);
      }
    } else {
      showInstallInstructions();
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    // Salva la preferenza nel localStorage
    localStorage.setItem('pwa-banner-dismissed', 'true');
  };

  // Controlla se il banner è stato precedentemente chiuso
  useEffect(() => {
    const dismissed = localStorage.getItem('pwa-banner-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
    }
  }, []);

  if (!isVisible || isInstalled || !isMobile) {
    return null;
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 md:left-auto md:right-4 md:max-w-sm">
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-4 animate-in slide-in-from-bottom-2 duration-300">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <Smartphone className="w-5 h-5 text-blue-600 mr-2" />
              <h3 className="font-semibold text-gray-900">Installa DEMOS</h3>
            </div>
            <p className="text-sm text-gray-600 mb-3">
              Aggiungi DEMOS alla schermata home per un accesso più veloce e un'esperienza migliore.
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleInstall}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isInstallable ? (
                  <>
                    <Download className="w-4 h-4 mr-1" />
                    Installa
                  </>
                ) : (
                  <>
                    <Smartphone className="w-4 h-4 mr-1" />
                    Istruzioni
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDismiss}
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
