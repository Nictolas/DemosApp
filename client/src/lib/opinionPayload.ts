/**
 * Validate the identity of published questions before encrypting a response
 * snapshot or trusting one read back from IndexedDB.
 *
 * The IDs are the stable catalog/answer-column IDs, not slugs regenerated
 * from question text. This is independent of the future DB storage model.
 * Invalid local cache data may be replaced by the authenticated server GET.
 */
export type CachedOpinionQuestion = {
  id: string;
  text: string;
  userAnswer: "f" | "c" | "i" | null;
  grado?: unknown;
};

const canonicalId = /^[a-z][a-z0-9_]{0,62}$/;
const maxQuestions = 500;

export function parseOpinionQuestions(raw: unknown): CachedOpinionQuestion[] {
  if (!Array.isArray(raw) || raw.length > maxQuestions) {
    throw new Error("Formato opinioni non valido.");
  }
  const ids = new Set<string>();
  return raw.map((value: unknown) => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Domanda opinione non valida.");
    }
    const q = value as Record<string, unknown>;
    if (typeof q.id !== "string" || !canonicalId.test(q.id) || ids.has(q.id) ||
        typeof q.text !== "string" || !q.text.trim()) {
      throw new Error("ID o testo di un'Opinione non valido.");
    }
    ids.add(q.id);
    const answer = q.userAnswer;
    return {
      id: q.id,
      text: q.text,
      userAnswer: answer === "f" || answer === "c" || answer === "i" ? answer : null,
      ...(q.grado === undefined ? {} : { grado: q.grado }),
    };
  });
}
