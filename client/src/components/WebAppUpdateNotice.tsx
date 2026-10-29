import { useEffect, useState } from "react";

// La shell Web/PWA può rimanere aperta in memoria su iOS dopo una release.
// Confronta soltanto il nome del bundle pubblico Vite (hash del contenuto),
// senza interrogare Supabase e senza inviare cookie, token o dati utente.
const CHECK_INTERVAL_MS = 15 * 60 * 1000;
const MIN_CHECK_GAP_MS = 3 * 60 * 1000;
const MAIN_BUNDLE_PATTERN = /\/assets\/index-[A-Za-z0-9_-]+\.js/;

export function WebAppUpdateNotice() {
  const [availableBundle, setAvailableBundle] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Un'app Capacitor nativa richiede l'aggiornamento dello store, non
    // un reload della WebView: questa funzionalità è solo per web/PWA.
    if (!/^https?:$/.test(window.location.protocol) ||
        window.location.hostname === "localhost" ||
        Boolean((window as any).Capacitor?.isNativePlatform?.())) {
      return;
    }

    const loadedBundle = [...document.querySelectorAll<HTMLScriptElement>('script[type="module"][src]')]
      .map((node) => new URL(node.src, window.location.href).pathname)
      .find((pathname) => MAIN_BUNDLE_PATTERN.test(pathname));
    if (!loadedBundle) return;

    let lastCheck = 0;
    let disposed = false;
    const controller = new AbortController();

    async function checkVersion() {
      if (document.visibilityState === "hidden") return;
      const now = Date.now();
      if (now - lastCheck < MIN_CHECK_GAP_MS) return;
      lastCheck = now;
      try {
        const url = new URL("/", window.location.origin);
        url.searchParams.set("__demos_version_check", String(now));
        const response = await fetch(url.toString(), {
          cache: "no-store",
          credentials: "omit",
          headers: { Accept: "text/html" },
          signal: controller.signal
        });
        if (!response.ok || !(response.headers.get("content-type") || "").includes("text/html")) return;
        const html = await response.text();
        const latestBundle = html.match(MAIN_BUNDLE_PATTERN)?.[0];
        if (!disposed && latestBundle && latestBundle !== loadedBundle) {
          setAvailableBundle(latestBundle);
        }
      } catch {
        // La verifica deve rimanere silenziosa e non bloccare mai l'app offline.
      }
    }

    const onResume = () => { void checkVersion(); };
    void checkVersion();
    document.addEventListener("visibilitychange", onResume);
    window.addEventListener("pageshow", onResume);
    window.addEventListener("focus", onResume);
    const interval = window.setInterval(onResume, CHECK_INTERVAL_MS);
    return () => {
      disposed = true;
      controller.abort();
      document.removeEventListener("visibilitychange", onResume);
      window.removeEventListener("pageshow", onResume);
      window.removeEventListener("focus", onResume);
      window.clearInterval(interval);
    };
  }, []);

  if (!availableBundle || dismissed) return null;

  const applyUpdate = () => {
    // Aggiornamento esplicito: non perdere eventuali dati di un form durante
    // una sessione in corso. Il query param impedisce di riutilizzare la
    // vecchia risposta HTML anche se una cache intermedia ignora no-store.
    const next = new URL(window.location.href);
    const bundleHash = availableBundle.match(/index-([A-Za-z0-9_-]+)\.js/)?.[1] || String(Date.now());
    next.searchParams.set("__demos_ui", bundleHash);
    window.location.replace(next.toString());
  };

  return (
    <div role="status" className="fixed left-3 right-3 z-[500] pointer-events-none"
      style={{ top: "calc(env(safe-area-inset-top, 0px) + 12px)" }}>
      <div className="pointer-events-auto mx-auto max-w-md rounded-xl border border-blue-200 bg-white px-4 py-3 shadow-xl flex items-center justify-between gap-3">
        <p className="min-w-0 text-sm font-medium text-slate-900">
          È disponibile una nuova versione di DEMOS.
        </p>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={applyUpdate}
            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white">
            Aggiorna
          </button>
          <button type="button" onClick={() => setDismissed(true)}
            className="rounded-lg px-2 py-2 text-xs text-slate-500"
            aria-label="Aggiorna più tardi" title="Più tardi">
            Più tardi
          </button>
        </div>
      </div>
    </div>
  );
}
