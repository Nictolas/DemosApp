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
let clearingAllVault = false;
const clearingOwners = new Set<string>();

export type ProfileChosenVotes = {
  capoStato: string[];
  grazia: string[];
  amnistia: string[];
  iniziativaPopolare: string[];
  attivista: { id: string; nome: string } | null;
  organizzazione: { id: string; nome: string } | null;
};

export type ProfileCacheSection =
  | "full" | "government" | "representatives" | "candidates"
  | "opinions" | "preferences" | "opinionE" | "opinionN" | "opinionR" | "opinionCO";

// The generation advances on writes AND on account/consent resets. A GET
// started before a successful write must not put its stale result back on disk.
const sectionRevisions = new Map<string, number>();
export function profileSectionRevision(owner: string, section: ProfileCacheSection): string {
  return `${activeEpoch}:${sectionRevisions.get(owner + ":" + section) || 0}`;
}

export type EncryptedOpinionCategory = {
  version: 1;
  grade: "E" | "N" | "R" | "CO";
  // Content hash served from the backend release catalog (never user data).
  catalogRevision: string;
  questions: Array<{ id: string; text: string; userAnswer: "f" | "c" | "i" | null; grado?: unknown }>;
};

export type OpinionCategorySection = "opinionE" | "opinionN" | "opinionR" | "opinionCO";

export type PersistedProfile = {
  version: 1;
  consent: { granted: boolean; timestamp: string | null } | null;
  full: Record<string, unknown> | null;
  government: Record<string, string> | null;
  representatives: Record<string, unknown> | null;
  candidates: Record<string, unknown> | null;
  opinions: { questions: unknown[]; userAnswers: Record<string, string>; answersLoaded?: boolean } | null;
  preferences?: ProfileChosenVotes | null;
  opinionE?: EncryptedOpinionCategory | null;
  opinionN?: EncryptedOpinionCategory | null;
  opinionR?: EncryptedOpinionCategory | null;
  opinionCO?: EncryptedOpinionCategory | null;
};

const emptyProfile = (): PersistedProfile => ({
  version: 1, consent: null, full: null, government: null,
  representatives: null, candidates: null, opinions: null,
  preferences: null,
  opinionE: null, opinionN: null, opinionR: null, opinionCO: null,
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

// Direct writes and serialized patch writes share the same purge barrier.
// A write may already be inside its IndexedDB transaction when logout or
// revocation begins: changing activeEpoch alone cannot cancel that transaction.
const inFlightWrites = new Map<string, Set<Promise<void>>>();

export async function storeEncryptedProfile(
  owner: string,
  profile: PersistedProfile,
): Promise<void> {
  if (!owner || !available() || clearingAllVault || clearingOwners.has(owner)) return;
  const epoch = activeEpoch;
  const write = (async () => {
    try {
      const key = await getKey();
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt({
        name: "AES-GCM",
        iv,
        additionalData: new TextEncoder().encode(ownerKey(owner)),
      }, key, new TextEncoder().encode(JSON.stringify(profile)));
      if (epoch !== activeEpoch || clearingAllVault || clearingOwners.has(owner)) return;
      await writeRaw(ownerKey(owner), { version: 1, iv, ciphertext } satisfies EncryptedRecord);
    } catch {
      // In private browsing or storage quota failures, keep the RAM fallback.
    }
  })();
  const active = inFlightWrites.get(owner) || new Set<Promise<void>>();
  active.add(write);
  inFlightWrites.set(owner, active);
  try { await write; } finally {
    active.delete(write);
    if (!active.size && inFlightWrites.get(owner) === active) inFlightWrites.delete(owner);
  }
}

async function settleOwnerWrites(owner: string): Promise<void> {
  // Wait for queued patch operations and transactions already in flight.
  // The purge flag/epoch is set FIRST, so they cannot start new writes.
  await Promise.allSettled([
    pendingWrites.get(owner) || Promise.resolve(),
    ...(inFlightWrites.get(owner) || []),
  ]);
}

const pendingWrites = new Map<string, Promise<void>>();

/** Serialize section updates so concurrent first-load GETs cannot overwrite
 * one another in the encrypted per-account record. */
export async function patchEncryptedProfile(
  owner: string,
  patch: Partial<PersistedProfile>,
  expectedRevisions?: Partial<Record<ProfileCacheSection, string>>,
): Promise<void> {
  if (!owner || !available() || clearingAllVault || clearingOwners.has(owner)) return;
  const epoch = activeEpoch;
  const prior = pendingWrites.get(owner) || Promise.resolve();
  const next = prior.catch(() => {}).then(async () => {
    if (epoch !== activeEpoch || clearingAllVault || clearingOwners.has(owner)) return;
    const existing = await loadEncryptedProfile(owner);
    if (epoch !== activeEpoch || clearingAllVault || clearingOwners.has(owner)) return;
    const safePatch = Object.fromEntries(Object.entries(patch).filter(([key]) => {
      const section = key as ProfileCacheSection;
      const expected = expectedRevisions?.[section];
      return expected === undefined || expected === profileSectionRevision(owner, section);
    })) as Partial<PersistedProfile>;
    if (Object.keys(safePatch).length === 0) return;
    await storeEncryptedProfile(owner, { ...emptyProfile(), ...existing, ...safePatch });
  });
  pendingWrites.set(owner, next);
  try { await next; } finally {
    if (pendingWrites.get(owner) === next) pendingWrites.delete(owner);
  }
}

/**
 * Opinion-category writes share the profile vault's serialization queue.
 * A GET started before a save/revocation cannot later overwrite the cache.
 * The verified consent epoch must be supplied by the authenticated session.
 */
export async function persistEncryptedOpinionCategory(
  owner: string,
  consentTimestamp: string | null,
  section: OpinionCategorySection,
  category: EncryptedOpinionCategory,
  expectedRevision: string,
): Promise<void> {
  if (!owner || !available()) return;
  const epoch = activeEpoch;
  const prior = pendingWrites.get(owner) || Promise.resolve();
  const next = prior.catch(() => {}).then(async () => {
    if (epoch !== activeEpoch || clearingAllVault || clearingOwners.has(owner) || expectedRevision !== profileSectionRevision(owner, section)) return;
    const existing = await loadEncryptedProfile(owner);
    if (epoch !== activeEpoch || expectedRevision !== profileSectionRevision(owner, section)) return;
    const matches = existing?.consent?.granted === true &&
      existing.consent.timestamp === consentTimestamp;
    // An old consent epoch must never carry cached political responses forward.
    const base = matches ? existing : {
      ...emptyProfile(), consent: { granted: true, timestamp: consentTimestamp },
    };
    await storeEncryptedProfile(owner, { ...base, [section]: category });
  });
  pendingWrites.set(owner, next);
  try { await next; } finally {
    if (pendingWrites.get(owner) === next) pendingWrites.delete(owner);
  }
}

export async function mergeEncryptedOpinionAnswers(
  owner: string,
  consentTimestamp: string | null,
  answers: Readonly<Record<string, string>>,
): Promise<void> {
  if (!owner || !available() || clearingAllVault || clearingOwners.has(owner)) return;
  // Prevent an already-running GET from resurrecting pre-commit answers.
  const sections: OpinionCategorySection[] = ["opinionE", "opinionN", "opinionR", "opinionCO"];
  for (const section of sections) {
    const key = owner + ":" + section;
    sectionRevisions.set(key, (sectionRevisions.get(key) || 0) + 1);
  }
  const epoch = activeEpoch;
  const prior = pendingWrites.get(owner) || Promise.resolve();
  const next = prior.catch(() => {}).then(async () => {
    if (epoch !== activeEpoch || clearingAllVault || clearingOwners.has(owner)) return;
    const existing = await loadEncryptedProfile(owner);
    if (epoch !== activeEpoch || clearingAllVault || clearingOwners.has(owner) || existing?.consent?.granted !== true ||
        existing.consent.timestamp !== consentTimestamp) return;
    const patch: Partial<PersistedProfile> = {};
    for (const section of sections) {
      const category = existing[section];
      if (!category) continue;
      patch[section] = {
        ...category,
        questions: category.questions.map(question => {
          const value = answers[question.id];
          return value === "f" || value === "c" || value === "i"
            ? { ...question, userAnswer: value } : question;
        }),
      };
    }
    // The legacy profile opinion view reads userAnswers; keep it consistent too.
    const currentProfileOpinions = existing.opinions;
    if (currentProfileOpinions) {
      patch.opinions = {
        ...currentProfileOpinions,
        userAnswers: { ...currentProfileOpinions.userAnswers, ...answers },
      };
    }
    await storeEncryptedProfile(owner, { ...existing, ...patch });
  });
  pendingWrites.set(owner, next);
  try { await next; } finally {
    if (pendingWrites.get(owner) === next) pendingWrites.delete(owner);
  }
}

/** Drop only changed profile sections, preserving all unrelated encrypted data.
 * Invalidations share the same serialized writer as the normal GET snapshots. */
export async function invalidateEncryptedProfileSections(
  owner: string,
  sections: readonly ProfileCacheSection[],
): Promise<void> {
  if (!owner || sections.length === 0) return;
  const unique = [...new Set(sections)];
  for (const section of unique) {
    const key = owner + ":" + section;
    sectionRevisions.set(key, (sectionRevisions.get(key) || 0) + 1);
  }
  await patchEncryptedProfile(owner,
    Object.fromEntries(unique.map(section => [section, null])) as Partial<PersistedProfile>);
}

export async function clearEncryptedProfile(owner: string): Promise<void> {
  activeEpoch += 1;
  if (!owner || !available()) return;
  clearingOwners.add(owner);
  try {
    await settleOwnerWrites(owner);
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(ownerKey(owner));
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } catch { /* Best effort when storage disabled */ }
  finally { clearingOwners.delete(owner); }
}

export async function clearAllEncryptedProfiles(): Promise<void> {
  activeEpoch += 1;
  sectionRevisions.clear();
  clearingAllVault = true;
  try {
    if (!available()) return;
    await Promise.allSettled([
      ...pendingWrites.values(),
      ...Array.from(inFlightWrites.values()).flatMap(writes => [...writes]),
    ]);
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
  finally { clearingAllVault = false; }
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
