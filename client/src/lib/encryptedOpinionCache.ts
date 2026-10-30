import { apiRequest } from "@/lib/queryClient";
import { parseOpinionQuestions } from "./opinionPayload";
import {
  loadEncryptedProfile,
  persistEncryptedOpinionCategory,
  mergeEncryptedOpinionAnswers,
  profileSectionRevision,
  type EncryptedOpinionCategory,
  type OpinionCategorySection,
} from "@/pages/Profilo/utils/encryptedProfileVault";

// Schema revision (not content revision): changes to official questions are
// detected by the backend's SHA-256 release catalog. This lightweight HTTP
// metadata check performs zero personal-answer / Supabase reads.
export const OPINION_CATEGORY_CACHE_VERSION = 1;
const CATALOG_REVISION_TTL_MS = 5 * 60 * 1000;
let lastRevision: { value: string; at: number } | null = null;
let pendingRevision: Promise<string | null> | null = null;

async function getPublishedCatalogRevision(): Promise<string | null> {
  if (lastRevision && Date.now() - lastRevision.at < CATALOG_REVISION_TTL_MS) {
    return lastRevision.value;
  }
  if (pendingRevision) return pendingRevision;
  pendingRevision = (async () => {
    try {
      const response = await apiRequest("GET", "/api/opinioni-catalog-revision");
      const revision = response.data?.revision;
      if (response.ok && response.data?.success === true &&
          typeof revision === "string" && /^[a-f0-9]{64}$/.test(revision)) {
        lastRevision = { value: revision, at: Date.now() };
        return revision;
      }
    } catch {
      // An older backend or a network failure cannot validate catalog data.
      // Fail closed for the persistent cache; use the authenticated GET below.
    }
    lastRevision = null;
    return null;
  })();
  try { return await pendingRevision; } finally { pendingRevision = null; }
}

export type OpinionGrade = "E" | "N" | "R" | "CO";
export type OpinionPayload = {
  success: true;
  data: EncryptedOpinionCategory["questions"];
  grado: string;
  total: number;
};

const sections: Record<OpinionGrade, OpinionCategorySection> = {
  E: "opinionE", N: "opinionN", R: "opinionR", CO: "opinionCO",
};

// Consent must carry a non-blank server-verified epoch before any personal
// responses can enter or be reused from persistent encrypted storage.
function hasVerifiedConsentEpoch(epoch: string | null): epoch is string {
  return typeof epoch === "string" && epoch.trim().length > 0;
}


/**
 * No network read when the authenticated owner's encrypted snapshot is valid.
 * Authorization is checked by /auth/me before the caller starts this query.
 * Cache contents never grant consent; an epoch mismatch requires a server read.
 */
export async function loadOpinionCategory(
  owner: string,
  consentEpoch: string | null,
  grade: OpinionGrade,
  signal?: AbortSignal,
): Promise<OpinionPayload> {
  // A granted flag without a verified epoch cannot authorize a personal GET.
  // Reject before even requesting the public catalog revision or reading vault.
  if (!owner || !hasVerifiedConsentEpoch(consentEpoch) || signal?.aborted) {
    throw new Error("Sessione o consenso non verificati");
  }
  const section = sections[grade];
  const revision = profileSectionRevision(owner, section);
  const [catalogRevision, snapshot] = await Promise.all([
    getPublishedCatalogRevision(), loadEncryptedProfile(owner),
  ]);
  if (signal?.aborted || revision !== profileSectionRevision(owner, section)) {
    throw new Error("Caricamento opinioni annullato");
  }
  // Accounts without a server-supplied consent epoch cannot safely retain a
  // persistent snapshot across revocation/regrant; use network as fallback.
  const cached = hasVerifiedConsentEpoch(consentEpoch) && snapshot?.consent?.granted === true &&
    snapshot.consent.timestamp === consentEpoch ? snapshot[section] : null;
  if (catalogRevision !== null && cached?.version === OPINION_CATEGORY_CACHE_VERSION &&
      cached.grade === grade && cached.catalogRevision === catalogRevision) {
    // Encrypted != automatically valid: older cache releases or corrupt
    // snapshots may contain textual slugs or duplicate IDs. Fail closed
    // to the ordinary authenticated GET rather than returning them.
    try {
      const questions = parseOpinionQuestions(cached.questions);
      return { success: true, data: questions, grado: grade, total: questions.length };
    } catch {
      // Invalid cache is not authoritative; do not re-use or merge it.
    }
  }

  const response = await apiRequest("GET", `/api/opinioni-list?grado=${grade}`, undefined, undefined, signal);
  if (!response.ok || response.data?.success !== true) {
    throw new Error("Impossibile caricare le opinioni.");
  }
  const questions = parseOpinionQuestions(response.data?.data);
  if (signal?.aborted || revision !== profileSectionRevision(owner, section)) {
    throw new Error("Caricamento opinioni annullato");
  }
  if (hasVerifiedConsentEpoch(consentEpoch) && catalogRevision !== null) {
    await persistEncryptedOpinionCategory(owner, consentEpoch, section,
      { version: OPINION_CATEGORY_CACHE_VERSION, catalogRevision, grade, questions }, revision);
  }
  // The encrypted vault serializes disk writes. Consent revocation, account
  // change or a confirmed save may advance the revision WHILE we await that
  // queue. Do not return a now-stale payload even if the vault discarded it.
  if (signal?.aborted || revision !== profileSectionRevision(owner, section)) {
    throw new Error("Caricamento opinioni annullato");
  }
  return { success: true, data: questions, grado: grade, total: questions.length };
}

/** Only after the API acknowledges all changed IDs, synchronise encrypted
 * sections sharing the same question ID. Never persist unacknowledged drafts. */
export async function cacheConfirmedOpinionAnswers(
  owner: string,
  consentEpoch: string | null,
  answers: Readonly<Record<string, string>>,
): Promise<void> {
  if (!owner || !hasVerifiedConsentEpoch(consentEpoch) || Object.keys(answers).length === 0) return;
  await mergeEncryptedOpinionAnswers(owner, consentEpoch, answers);
}
