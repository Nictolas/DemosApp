import * as React from "react";
import { useViewModeOptional } from "@/hooks/useViewMode";

const MOBILE_BREAKPOINT = 768;

export function useMobile() {
  const viewMode = useViewModeOptional();
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(
    undefined,
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
