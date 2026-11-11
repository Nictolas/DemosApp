import { useCallback } from "react";
import type { MouseEvent } from "react";
import { flushSync } from "react-dom";
import { useLocation } from "wouter";

type Direction = "forward" | "back";
type TransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

// The nested Profile scrollport is not handled by the browser's window scroll
// restoration. Keep only its position in memory (no profile data in storage).
let profileScrollToRestore: number | null = null;

export function rememberProfileScroll(top: number) {
  profileScrollToRestore = Math.max(0, top);
}

export function getProfileScrollToRestore() {
  return profileScrollToRestore;
}

export function clearProfileScrollToRestore() {
  profileScrollToRestore = null;
}

export function isPlainNavigationClick(event: MouseEvent<HTMLElement>) {
  return event.button === 0 &&
    !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey &&
    !event.defaultPrevented;
}

/**
 * View Transitions is progressive enhancement. Unsupported WebViews, keyboard
 * accessibility preferences and reduced-motion users take the regular route.
 * Navigation is synchronous, so the new Wouter route is mounted for the
 * browser's after-snapshot without keeping the old page alive.
 */
export function useSmoothNavigation() {
  const [, setLocation] = useLocation();

  return useCallback((to: string, direction: Direction = "forward") => {
    const doc = document as TransitionDocument;
    if (!doc.startViewTransition ||
        window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setLocation(to);
      return;
    }

    const html = doc.documentElement;
    html.dataset.demosNavigation = direction;
    try {
      const transition = doc.startViewTransition(() => {
        flushSync(() => setLocation(to));
      });
      void transition.finished.then(
        () => { if (html.dataset.demosNavigation === direction) delete html.dataset.demosNavigation; },
        () => { if (html.dataset.demosNavigation === direction) delete html.dataset.demosNavigation; },
      );
    } catch {
      delete html.dataset.demosNavigation;
      setLocation(to);
    }
  }, [setLocation]);
}
