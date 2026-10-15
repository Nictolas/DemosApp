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
  const { enabled, token: fcmToken, permission, requestPermission, getToken, transport } = usePushNotifications();

  useEffect(() => {
    if (!user?.id || !enabled) return;

    if (permission === null || permission === 'default') {
      const permissionStorageKey = `push_permission_requested_${transport}`;
      const hasRequested = localStorage.getItem(permissionStorageKey);
      if (!hasRequested) {
        void requestPermission();
        localStorage.setItem(permissionStorageKey, 'true');
      }
      return;
    }

    if (permission === 'denied') return;

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
  }, [user?.id, enabled, fcmToken, permission, requestPermission, getToken, transport]);
}
