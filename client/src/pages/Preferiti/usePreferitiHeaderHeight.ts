import { useLayoutEffect, useRef } from "react";

/** Misura l'header (logo) e imposta --preferiti-header-h per ancorare la griglia. */
export function usePreferitiHeaderHeight() {
  const pageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const page = pageRef.current;
    const header = headerRef.current;
    if (!page || !header) return;

    const sync = () => {
      page.style.setProperty("--preferiti-header-h", `${header.offsetHeight}px`);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  return { pageRef, headerRef };
}
