import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { apiRequest } from "@/lib/queryClient";

/**
 * Sincronizza il token push con il server quando l'utente è autenticato.
 * Web/PWA usa FCM web; Capacitor usa il token FCM nativo Android.
 */
export function useSyncFcmToken() {
  const { user } = useAuth();
  const { enabled, token: fcmToken, permission, getToken, transport } = usePushNotifications();

  useEffect(() => {
    if (!user?.id || !enabled) return;

    // Never open an OS/browser notification-permission dialog on login.
    // Only the user's explicit "Consenti notifiche" action in
    // NotifichePreferenze may request permission. The server separately
    // enforces topic-specific preferences (default OFF for civic alerts).
    if (permission !== 'granted') return;

    if (permission === 'granted' && !fcmToken) {
      void getToken();
      return;
    }

    if (!fcmToken) return;

    // Il trasporto nativo è sempre mobile. Per il web manteniamo la policy mobile-only.
    const isMobileWeb = /Mobile|Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    if (transport === 'web' && !isMobileWeb) {
      console.log('Token FCM web da desktop ignorato (solo token mobile vengono salvati)');
      return;
    }

    const saveToken = async () => {
      try {
        await apiRequest('POST', '/api/fcm-tokens', {
          token: fcmToken,
          source: transport === 'native' ? 'android-native' : 'web-mobile',
        });
        console.log(`Token push ${transport} sincronizzato con successo`);
      } catch (error: any) {
        console.warn('Errore nella sincronizzazione token push:', error?.message || error);
      }
    };

    void saveToken();
  }, [user?.id, enabled, fcmToken, permission, getToken, transport]);
}
