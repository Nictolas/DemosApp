import { useLayoutEffect, useRef } from "react";

/** Misura l'header e imposta una CSS variable per ancorare il contenuto sotto. */
export function usePreferitiHeaderHeight(cssVariable = "--preferiti-header-h") {
  const pageRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const page = pageRef.current;
    const header = headerRef.current;
    if (!page || !header) return;

    const sync = () => {
      page.style.setProperty(cssVariable, `${header.offsetHeight}px`);
    };

    sync();
    const observer = new ResizeObserver(sync);
    observer.observe(header);
    return () => observer.disconnect();
  }, [cssVariable]);

  return { pageRef, headerRef };
}
