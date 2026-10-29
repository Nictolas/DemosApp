/**
 * Per-account encrypted on-device profile data.
 *
 * Data is encrypted with a non-extractable WebCrypto AES-GCM key persisted
 * by IndexedDB. This is protection against casual disk inspection, NOT
 * protection against code executing on this same origin (e.g. XSS).
 * No server credentials, auth tokens, or password fields are stored.
 * If storage is disabled, the app can still work from network/RAM.
 */
const DB_NAME = "demos-profile-vault-v1";
const STORE_NAME = "entries";
const CRYPTO_KEY = "__crypto_key__";
const OWNER_PREFIX = "owner:";
const DB_VERSION = 1;
let activeEpoch = 0;
let openedDb: Promise<IDBDatabase> | undefined;
let vaultKey: Promise<CryptoKey> | undefined;

export type PersistedProfile = {
  version: 1;
  consent: { granted: boolean; timestamp: string | null } | null;
  full: Record<string, unknown> | null;
  government: Record<string, string> | null;
  representatives: Record<string, unknown> | null;
  candidates: Record<string, unknown> | null;
  opinions: { questions: unknown[]; userAnswers: Record<string, string> } | null;
};

const emptyProfile = (): PersistedProfile => ({
  version: 1, consent: null, full: null, government: null,
  representatives: null, candidates: null, opinions: null,
});

const available = () => typeof window !== "undefined" &&
  typeof indexedDB !== "undefined" && !!globalThis.crypto?.subtle;

function request<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed"));
  });
}

function openDb(): Promise<IDBDatabase> {
  if (!available()) return Promise.reject(new Error("Local encrypted vault unavailable"));
  if (!openedDb) {
    openedDb = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE_NAME)) {
          req.result.createObjectStore(STORE_NAME);
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Cannot open encrypted vault"));
    }).catch((error) => {
      openedDb = undefined;
      throw error;
    });
  }
  return openedDb;
}

async function readRaw<T>(id: string): Promise<T | undefined> {
  const db = await openDb();
  return await request(db.transaction(STORE_NAME, "readonly")
    .objectStore(STORE_NAME).get(id)) as T | undefined;
}

async function writeRaw(id: string, value: unknown): Promise<void> {
  const db = await openDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(value, id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

async function getKey(): Promise<CryptoKey> {
  if (!vaultKey) {
    vaultKey = (async () => {
      const saved = await readRaw<CryptoKey>(CRYPTO_KEY);
      if (saved) return saved;
      const generated = await crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"],
      );
      await writeRaw(CRYPTO_KEY, generated);
      return generated;
    })().catch(error => { vaultKey = undefined; throw error; });
  }
  return vaultKey;
}

function ownerKey(owner: string): string {
  return OWNER_PREFIX + encodeURIComponent(owner);
}

type EncryptedRecord = {
  version: 1;
  iv: Uint8Array;
  ciphertext: ArrayBuffer;
};

export async function loadEncryptedProfile(owner: string): Promise<PersistedProfile | null> {
  if (!owner || !available()) return null;
  try {
    const saved = await readRaw<EncryptedRecord>(ownerKey(owner));
    if (!saved || saved.version !== 1) return null;
    const key = await getKey();
    const plain = await crypto.subtle.decrypt({
      name: "AES-GCM",
      iv: saved.iv as BufferSource,
      additionalData: new TextEncoder().encode(ownerKey(owner)),
    }, key, saved.ciphertext);
    const parsed = JSON.parse(new TextDecoder().decode(plain)) as PersistedProfile;
    if (parsed?.version !== 1) return null;
    return { ...emptyProfile(), ...parsed };
  } catch {
    // Corrupted or inaccessible cache: leave server as canonical source.
    return null;
  }
}

export async function storeEncryptedProfile(
  owner: string,
  profile: PersistedProfile,
): Promise<void> {
  if (!owner || !available()) return;
  const epoch = activeEpoch;
  try {
    const key = await getKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await crypto.subtle.encrypt({
      name: "AES-GCM",
      iv,
      additionalData: new TextEncoder().encode(ownerKey(owner)),
    }, key, new TextEncoder().encode(JSON.stringify(profile)));
    if (epoch !== activeEpoch) return; // logout/revocation raced this write
    await writeRaw(ownerKey(owner), { version: 1, iv, ciphertext } satisfies EncryptedRecord);
  } catch {
    // In private browsing or storage quota failures, keep the RAM fallback.
  }
}

const pendingWrites = new Map<string, Promise<void>>();

/** Serialize section updates so concurrent first-load GETs cannot overwrite
 * one another in the encrypted per-account record. */
export async function patchEncryptedProfile(
  owner: string,
  patch: Partial<PersistedProfile>,
): Promise<void> {
  if (!owner || !available()) return;
  const epoch = activeEpoch;
  const prior = pendingWrites.get(owner) || Promise.resolve();
  const next = prior.catch(() => {}).then(async () => {
    if (epoch !== activeEpoch) return;
    const existing = await loadEncryptedProfile(owner);
    if (epoch !== activeEpoch) return;
    await storeEncryptedProfile(owner, { ...emptyProfile(), ...existing, ...patch });
  });
  pendingWrites.set(owner, next);
  try { await next; } finally {
    if (pendingWrites.get(owner) === next) pendingWrites.delete(owner);
  }
}

export async function clearEncryptedProfile(owner: string): Promise<void> {
  activeEpoch += 1;
  if (!owner || !available()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(ownerKey(owner));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch { /* Best effort when storage disabled */ }
}

export async function clearAllEncryptedProfiles(): Promise<void> {
  activeEpoch += 1;
  if (!available()) return;
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
    vaultKey = undefined;
  } catch { /* Best effort when storage disabled */ }
}

/** Keep only profile form fields and the legacy opinion/selection flags,
 * never arbitrary /api/users/me response keys such as password_hash. */
const PROFILE_FIELDS = new Set([
  "id", "nome", "cognome", "nome_completo", "ruolo", "status",
  "data_nascita", "genere", "sesso", "cittadinanza",
  "paese_residenza", "regione_residenza", "provincia_residenza",
  "comune_residenza", "paese_elezione", "regione_elezione",
  "provincia_elezione", "comune_elezione",
  "paese_candidatura", "regione_candidatura",
  "provincia_candidatura", "comune_candidatura",
  "grado_elezione", "grado_candidatura", "professione", "istruzione",
  "telefono", "avatar_config", "tipologie_attivismo",
  "energia_nucleare", "sperimentazione_animale",
  "legalizzazione_canapa", "caccia",
  "rappresentante_europeo", "rappresentante_camera",
  "rappresentante_senato", "rappresentante_regionale",
  "rappresentante_comunale", "candidato_europeo",
  "candidato_camera", "candidato_senato",
  "candidato_regionale", "candidato_comunale",
]);

export function filterPersistedFullProfile(
  source: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => PROFILE_FIELDS.has(key)),
  );
}
