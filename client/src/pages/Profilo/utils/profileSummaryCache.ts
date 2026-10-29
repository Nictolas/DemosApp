import type { UserInfo } from "@/types/profile";

const PREFIX = "demos:profile-summary:v1:";
export const PROFILE_SUMMARY_TTL_MS = 24 * 60 * 60 * 1000;

type StoredSummary = { savedAt: number; user: UserInfo };

// Never write the full /users/me object to persistent storage: it contains
// opinions, selection IDs, contact details and other private fields.
const ALLOWED_FIELDS = [
  "id", "ruolo", "status", "data_nascita", "cittadinanza",
  "paese_residenza", "regione_residenza", "provincia_residenza",
  "comune_residenza", "avatar_config",
] as const;
const safeKey = (userId: string) => PREFIX + encodeURIComponent(userId);

const yearOnly = (value: unknown): string => {
  if (typeof value !== "string") return "";
  if (/^\d{4}$/.test(value)) return value;
  return value.match(/^(\d{4})-\d{2}-\d{2}/)?.[1] ||
    value.match(/^\d{1,2}\/\d{1,2}\/(\d{4})$/)?.[1] || "";
};

export function stripSensitiveProfileFields(user: UserInfo): UserInfo {
  const clean: Record<string, unknown> = {};
  for (const field of ALLOWED_FIELDS) {
    const value = user[field];
    if (typeof value === "string" && value.length <= 400) clean[field] = value;
  }
  clean.id = user.id;
  clean.ruolo = user.ruolo;
  clean.data_nascita = yearOnly(user.data_nascita);
  // Avatar artwork is harmless, but limit its encoded payload size.
  const avatar = user.avatar_config;
  if (avatar && JSON.stringify(avatar).length < 8000) clean.avatar_config = avatar;
  // Public names are displayed only for politician/candidate profiles.
  if (["P", "C", "CP"].includes(user.ruolo)) {
    if (typeof user.nome === "string" && user.nome.length < 100) clean.nome = user.nome;
    if (typeof user.cognome === "string" && user.cognome.length < 100) clean.cognome = user.cognome;
  }
  return clean as UserInfo;
}

export function readProfileSummary(userId: string): StoredSummary | null {
  if (typeof window === "undefined" || !userId) return null;
  try {
    const raw = window.localStorage.getItem(safeKey(userId));
    if (!raw) return null;
    const item = JSON.parse(raw) as StoredSummary;
    if (item?.user?.id !== userId ||
        !Number.isFinite(item.savedAt) ||
        item.savedAt > Date.now() ||
        Date.now() - item.savedAt >= PROFILE_SUMMARY_TTL_MS) {
      window.localStorage.removeItem(safeKey(userId));
      return null;
    }
    // Apply the allowlist AGAIN so an old/corrupt cache cannot inject choices.
    return { savedAt: item.savedAt, user: stripSensitiveProfileFields(item.user) };
  } catch {
    window.localStorage.removeItem(safeKey(userId));
    return null;
  }
}

export function storeProfileSummary(userId: string, user: UserInfo): void {
  if (typeof window === "undefined" || !userId || user.id !== userId) return;
  try {
    window.localStorage.setItem(safeKey(userId), JSON.stringify({
      savedAt: Date.now(),
      user: stripSensitiveProfileFields(user),
    } satisfies StoredSummary));
  } catch {
    // App continues from RAM when persistent storage is unavailable.
  }
}

export function clearProfileSummary(userId: string): void {
  if (typeof window === "undefined" || !userId) return;
  try { window.localStorage.removeItem(safeKey(userId)); } catch {}
}

export function clearAllProfileSummaries(): void {
  if (typeof window === "undefined") return;
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i--) {
      const key = window.localStorage.key(i);
      if (key?.startsWith(PREFIX)) window.localStorage.removeItem(key);
    }
    // Prevent reusing the old cross-account local merge.
    window.localStorage.removeItem("profilo_locale");
  } catch {}
}
