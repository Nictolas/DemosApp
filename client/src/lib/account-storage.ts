const ACCOUNT_ID_KEY = "demos_account_id";
const LEGACY_ACCOUNT_ID_KEY = "webauthn_user_id";

export function getStoredAccountId(): string | null {
  if (typeof window === "undefined") return null;

  try {
    const current = window.localStorage.getItem(ACCOUNT_ID_KEY);
    if (current) return current;

    const legacy = window.localStorage.getItem(LEGACY_ACCOUNT_ID_KEY);
    if (!legacy) return null;

    // Migrazione trasparente: il nuovo nome diventa quello canonico.
    // Manteniamo temporaneamente la chiave legacy per compatibilità con vecchie
    // schermate ancora presenti nel frontend; verrà rimossa in una pulizia successiva.
    window.localStorage.setItem(ACCOUNT_ID_KEY, legacy);
    return legacy;
  } catch {
    return null;
  }
}

export function storeAccountId(userId: string | number | null | undefined): void {
  if (typeof window === "undefined" || userId == null) return;

  const value = String(userId).trim();
  if (!value) return;

  try {
    window.localStorage.setItem(ACCOUNT_ID_KEY, value);
    // Compatibilità temporanea con codice legacy che legge ancora direttamente
    // webauthn_user_id. I nuovi flussi devono usare demos_account_id tramite questo helper.
    window.localStorage.setItem(LEGACY_ACCOUNT_ID_KEY, value);
  } catch {
    // localStorage può essere indisponibile in modalità privacy/restrittiva.
  }
}

export function migrateLegacyAccountId(): string | null {
  return getStoredAccountId();
}
