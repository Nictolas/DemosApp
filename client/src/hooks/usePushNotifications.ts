import { useFCM } from '@/hooks/useFCM';
import { useNativePush } from '@/hooks/useNativePush';
import { isNativePushRuntime } from '@/lib/native-push';

export function usePushNotifications() {
  const webPush = useFCM();
  const nativePush = useNativePush();
  const nativeRuntime = isNativePushRuntime();

  if (nativeRuntime) {
    return {
      ...nativePush,
      transport: 'native' as const,
    };
  }

  return {
    ...webPush,
    enabled: true,
    transport: 'web' as const,
  };
}
