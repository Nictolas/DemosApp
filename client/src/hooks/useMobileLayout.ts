import { Capacitor } from "@capacitor/core";
import { useMobile } from "@/hooks/use-mobile";

/** true = layout mobile (navbar in basso). false = layout desktop (sidebar). */
export function useMobileLayout(): boolean {
  const isNarrowOrPreview = useMobile();

  try {
    if (Capacitor.isNativePlatform()) {
      return true;
    }
  } catch {
    // Capacitor non disponibile in web
  }

  return isNarrowOrPreview;
}
