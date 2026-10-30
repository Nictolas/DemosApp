/**
 * Only explicitly changed answers may be sent to /api/opinioni/salva.
 * Sending a full snapshot can overwrite edits made on another device.
 * NULL/missing means unanswered, never a fourth political position.
 */
export type OpinionAnswer = "f" | "c" | "i";
export type ExistingOpinion = { id: string; userAnswer?: string | null };

function normalized(value: unknown): OpinionAnswer | null {
  return value === "f" || value === "c" || value === "i" ? value : null;
}

export function collectChangedOpinionAnswers(
  questions: readonly ExistingOpinion[],
  current: Readonly<Record<string, string>>,
): Record<string, OpinionAnswer> {
  const changed: Record<string, OpinionAnswer> = Object.create(null);
  for (const question of questions) {
    const selected = normalized(current[question.id]);
    if (selected !== null && selected !== normalized(question.userAnswer)) {
      changed[question.id] = selected;
    }
  }
  return changed;
}
