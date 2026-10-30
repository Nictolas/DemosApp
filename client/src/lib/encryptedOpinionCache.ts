import { apiRequest } from "@/lib/queryClient";
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

function sanitiseQuestions(raw: unknown): EncryptedOpinionCategory["questions"] {
  if (!Array.isArray(raw)) throw new Error("Formato opinioni non valido.");
  return raw.map((question: any) => {
    if (!question || typeof question.id !== "string" || typeof question.text !== "string") {
      throw new Error("Domanda opinione non valida.");
    }
    const answer = question.userAnswer;
    return {
      id: question.id, text: question.text,
      userAnswer: answer === "f" || answer === "c" || answer === "i" ? answer : null,
      ...(question.grado === undefined ? {} : { grado: question.grado }),
    };
  });
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
  if (!owner || signal?.aborted) throw new Error("Sessione non valida");
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
  const cached = consentEpoch !== null && snapshot?.consent?.granted === true &&
    snapshot.consent.timestamp === consentEpoch ? snapshot[section] : null;
  if (catalogRevision !== null && cached?.version === OPINION_CATEGORY_CACHE_VERSION &&
      cached.grade === grade && cached.catalogRevision === catalogRevision) {
    return { success: true, data: cached.questions, grado: grade, total: cached.questions.length };
  }

  const response = await apiRequest("GET", `/api/opinioni-list?grado=${grade}`, undefined, undefined, signal);
  if (!response.ok || response.data?.success !== true) {
    throw new Error("Impossibile caricare le opinioni.");
  }
  const questions = sanitiseQuestions(response.data?.data);
  if (signal?.aborted || revision !== profileSectionRevision(owner, section)) {
    throw new Error("Caricamento opinioni annullato");
  }
  if (consentEpoch !== null && catalogRevision !== null) {
    await persistEncryptedOpinionCategory(owner, consentEpoch, section,
      { version: OPINION_CATEGORY_CACHE_VERSION, catalogRevision, grade, questions }, revision);
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
  if (!owner || Object.keys(answers).length === 0) return;
  await mergeEncryptedOpinionAnswers(owner, consentEpoch, answers);
}
