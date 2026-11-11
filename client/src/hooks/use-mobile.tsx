import * as React from "react";
import { useViewModeOptional } from "@/hooks/useViewMode";

const MOBILE_BREAKPOINT = 768;

export function useMobile() {
  const viewMode = useViewModeOptional();
  // Vite renders on the client: read the viewport before the first paint.
  // Starting as "desktop" on phones makes the login and shell jump on mount.
  const [isMobile, setIsMobile] = React.useState<boolean>(() =>
    typeof window !== "undefined" && window.innerWidth < MOBILE_BREAKPOINT,
  );

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };
    mql.addEventListener("change", onChange);
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  if (viewMode?.isMobilePreview) {
    return true;
  }

  return !!isMobile;
}
