import { useEffect } from "react";
import { useAuth } from "@/hooks/use-auth-neon";
import { useFCM } from "@/hooks/useFCM";
import { apiRequest } from "@/lib/queryClient";

/**
 * Hook per sincronizzare automaticamente il token FCM con il server
 * quando l'utente è loggato e ha concesso i permessi per le notifiche
 */
export function useSyncFcmToken() {
  const { user } = useAuth();
  const { token: fcmToken, permission, requestPermission, getToken } = useFCM();

  useEffect(() => {
    // Se l'utente non è loggato, non fare nulla
    if (!user?.id) {
      return;
    }

    // Se il permesso non è ancora stato richiesto, richiedilo
    if (permission === null || permission === 'default') {
      // Richiedi permesso solo una volta
      const hasRequested = localStorage.getItem('fcm_permission_requested');
      if (!hasRequested) {
        requestPermission();
        localStorage.setItem('fcm_permission_requested', 'true');
      }
      return;
    }

    // Se il permesso è negato, non fare nulla
    if (permission === 'denied') {
      return;
    }

    // Se abbiamo il permesso ma non abbiamo ancora il token, ottienilo
    if (permission === 'granted' && !fcmToken) {
      getToken();
      return;
    }

    // Se abbiamo un token FCM e l'utente è loggato, salvalo sul server
    if (fcmToken && user.id) {
      const saveToken = async () => {
        try {
          const response = await apiRequest('POST', '/api/fcm-tokens', {
            token: fcmToken
          });

          if (response?.ok || response?.status === 200) {
            console.log('✅ Token FCM sincronizzato con successo');
          } else {
            const data = await response?.json?.() || {};
            console.warn('⚠️ Errore nella sincronizzazione token FCM:', data?.error || 'Errore sconosciuto');
          }
        } catch (error: any) {
          console.warn('⚠️ Errore nella sincronizzazione token FCM:', error?.message || error);
        }
      };

      saveToken();
    }
  }, [user?.id, fcmToken, permission, requestPermission, getToken]);
}
