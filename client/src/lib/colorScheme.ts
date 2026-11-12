// Preferenza di aspetto: esclusivamente sul dispositivo, senza API o database.
export type ColorSchemePreference = "system" | "light" | "dark";

const STORAGE_KEY = "demos:color-scheme";
const MEDIA_QUERY = "(prefers-color-scheme: dark)";

export function readColorSchemePreference(): ColorSchemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // Storage disabilitato (es. navigazione privata): usa il sistema.
  }
  return "system";
}

export function applyColorScheme(preference: ColorSchemePreference = readColorSchemePreference()): void {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const dark = preference === "dark" ||
    (preference === "system" && Boolean(window.matchMedia?.(MEDIA_QUERY).matches));

  const root = document.documentElement;
  root.classList.toggle("dark", dark);
  root.style.colorScheme = dark ? "dark" : "light";

  // La barra del browser/PWA mantiene lo stesso colore del tema attivo.
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#0b1220" : "#1E1E1E");
}

export function saveColorSchemePreference(preference: ColorSchemePreference): void {
  if (typeof window === "undefined") return;
  try {
    if (preference === "system") {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, preference);
    }
  } catch {
    // L'aspetto si applica comunque alla sessione corrente.
  }
  applyColorScheme(preference);
}

let isInitialized = false;

export function initializeColorScheme(): void {
  if (typeof window === "undefined" || isInitialized) return;
  isInitialized = true;
  applyColorScheme();

  // Aggiornamento live quando cambia il tema iOS/Android/desktop.
  const media = window.matchMedia?.(MEDIA_QUERY);
  const onSystemChange = () => {
    if (readColorSchemePreference() === "system") applyColorScheme("system");
  };
  if (media?.addEventListener) {
    media.addEventListener("change", onSystemChange);
  } else if (media?.addListener) {
    media.addListener(onSystemChange);
  }

  // Sincronizza schede PWA/web dello stesso dispositivo, senza rete.
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) applyColorScheme();
  });
}
