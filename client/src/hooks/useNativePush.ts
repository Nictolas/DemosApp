import { useCallback, useEffect, useState } from 'react';
import type { PluginListenerHandle } from '@capacitor/core';
import {
  PushNotifications,
  type ActionPerformed,
  type PushNotificationSchema,
} from '@capacitor/push-notifications';
import {
  clearStoredNativePushToken,
  isNativePushEnabled,
  storeNativePushToken,
} from '@/lib/native-push';

const NATIVE_NOTIFICATION_CHANNELS = [
  {
    id: 'demos_notifications',
    name: 'Notifiche DEMOS',
    description: 'Comunicazioni e aggiornamenti DEMOS',
    importance: 4 as const,
    visibility: 1 as const,
    vibration: true,
  },
  {
    id: 'avvistamenti_notifications',
    name: 'Avvistamenti',
    description: 'Avvisi relativi agli avvistamenti nella tua zona',
    importance: 4 as const,
    visibility: 1 as const,
    vibration: true,
  },
];

function normalizePermission(receive: string): NotificationPermission {
  if (receive === 'granted') return 'granted';
  if (receive === 'denied') return 'denied';
  return 'default';
}

function getFallbackNotificationTarget(type: unknown): string | null {
  switch (String(type || '')) {
    case 'demos_notification':
      return '/comunica';
    case 'user_notification':
    case 'political_opinion_change':
    case 'avvistamento':
    case 'operational_alert':
      return '/notifiche';
    default:
      return null;
  }
}

async function ensureAndroidNotificationChannels() {
  for (const channel of NATIVE_NOTIFICATION_CHANNELS) {
    await PushNotifications.createChannel(channel);
  }
}

function openNotificationTarget(action: ActionPerformed) {
  if (typeof window === 'undefined') return;

  const data = action.notification?.data || {};
  const rawTarget =
    data.link ||
    data.url ||
    action.notification?.link ||
    getFallbackNotificationTarget(data.type);
  if (!rawTarget || typeof rawTarget !== 'string') return;

  try {
    const target = new URL(rawTarget, window.location.origin);
    const isDemosWeb = target.hostname === 'www.demos.community' || target.hostname === 'demos.community';
    const isCurrentOrigin = target.origin === window.location.origin;

    if (isDemosWeb || isCurrentOrigin) {
      window.location.href = `${target.pathname}${target.search}${target.hash}`;
      return;
    }

    window.open(target.toString(), '_blank', 'noopener,noreferrer');
  } catch {
    if (rawTarget.startsWith('/')) {
      window.location.href = rawTarget;
    }
  }
}

export function useNativePush() {
  const enabled = isNativePushEnabled();
  const [token, setToken] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission | null>(enabled ? 'default' : null);
  const [message, setMessage] = useState<PushNotificationSchema | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    const handles: PluginListenerHandle[] = [];

    const trackHandle = async (promise: Promise<PluginListenerHandle>) => {
      const handle = await promise;
      if (cancelled) {
        await handle.remove();
      } else {
        handles.push(handle);
      }
    };

    void ensureAndroidNotificationChannels().catch((channelError) => {
      if (!cancelled) {
        console.warn('Impossibile preparare i canali push Android:', channelError);
      }
    });

    void trackHandle(
      PushNotifications.addListener('registration', ({ value }) => {
        setToken(value);
        storeNativePushToken(value);
        setError(null);
        setIsLoading(false);
      }),
    );

    void trackHandle(
      PushNotifications.addListener('registrationError', (registrationError) => {
        setToken(null);
        clearStoredNativePushToken();
        setError(new Error(registrationError.error || 'Registrazione push nativa non riuscita'));
        setIsLoading(false);
      }),
    );

    void trackHandle(
      PushNotifications.addListener('pushNotificationReceived', (notification) => {
        setMessage(notification);
      }),
    );

    void trackHandle(
      PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
        setMessage(action.notification);
        openNotificationTarget(action);
      }),
    );

    void PushNotifications.checkPermissions()
      .then((status) => {
        if (!cancelled) setPermission(normalizePermission(status.receive));
      })
      .catch((permissionError) => {
        if (!cancelled) {
          setError(permissionError instanceof Error ? permissionError : new Error('Impossibile verificare il permesso notifiche'));
        }
      });

    return () => {
      cancelled = true;
      void Promise.all(handles.map((handle) => handle.remove()));
    };
  }, [enabled]);

  const register = useCallback(async () => {
    if (!enabled) return;
    setIsLoading(true);
    setError(null);
    try {
      await ensureAndroidNotificationChannels().catch((channelError) => {
        console.warn('Impossibile preparare i canali push Android prima della registrazione:', channelError);
      });
      await PushNotifications.register();
    } catch (registrationError) {
      setIsLoading(false);
      setError(registrationError instanceof Error ? registrationError : new Error('Registrazione push nativa non riuscita'));
    }
  }, [enabled]);

  const requestPermission = useCallback(async () => {
    if (!enabled) return;
    setError(null);
    try {
      const status = await PushNotifications.requestPermissions();
      const nextPermission = normalizePermission(status.receive);
      setPermission(nextPermission);
      if (nextPermission === 'granted') {
        await register();
      } else {
        setError(new Error('Permesso notifiche negato'));
      }
    } catch (permissionError) {
      setError(permissionError instanceof Error ? permissionError : new Error('Errore nella richiesta permesso notifiche'));
    }
  }, [enabled, register]);

  const getToken = useCallback(async () => {
    if (!enabled) return;
    try {
      const status = await PushNotifications.checkPermissions();
      const nextPermission = normalizePermission(status.receive);
      setPermission(nextPermission);
      if (nextPermission !== 'granted') {
        setError(new Error('Permesso notifiche non concesso'));
        return;
      }
      await register();
    } catch (tokenError) {
      setError(tokenError instanceof Error ? tokenError : new Error('Errore nel recupero token push nativo'));
    }
  }, [enabled, register]);

  return {
    enabled,
    token,
    permission,
    message,
    error,
    isLoading,
    requestPermission,
    getToken,
  };
}
