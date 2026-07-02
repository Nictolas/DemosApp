import { useLayoutEffect, useRef } from "react";

/**
 * Misura l'header della pagina e, quando presente, anche la navbar reale.
 * In questo modo i layout ancorati possono fermarsi sopra la navbar Android.
 */
export function usePreferitiHeaderHeight(cssVariable = "--preferiti-header-h") {
  const pageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const page = pageRef.current;
    const header = headerRef.current;
    if (!page || !header) return;

    const navbar = document.querySelector(".app-navbar") as HTMLElement | null;

    const sync = () => {
      page.style.setProperty(cssVariable, `${header.offsetHeight}px`);
      page.style.setProperty("--app-navbar-h", `${navbar?.offsetHeight ?? 0}px`);
    };

    sync();

    const headerObserver = new ResizeObserver(sync);
    headerObserver.observe(header);

    const navbarObserver = navbar ? new ResizeObserver(sync) : null;
    if (navbar && navbarObserver) {
      navbarObserver.observe(navbar);
    }

    window.addEventListener("resize", sync);
    window.visualViewport?.addEventListener("resize", sync);

    return () => {
      headerObserver.disconnect();
      navbarObserver?.disconnect();
      window.removeEventListener("resize", sync);
      window.visualViewport?.removeEventListener("resize", sync);
    };
  }, [cssVariable]);

  return { pageRef, headerRef };
}
