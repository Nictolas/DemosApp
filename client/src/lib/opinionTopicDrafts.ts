/** Drafts are transient, scoped to one verified owner, consent epoch and topic.
 * A background refresh must not silently erase unsaved political answers.
 * No storage, tracking, network call or new server-side mutation is involved.
 */
export type TopicDraftQuestion = Readonly<{ id: string; userAnswer?: string | null }>;
export type TopicDraftState = Readonly<{
  scope: string;
  confirmed: Readonly<Record<string, string | null>>;
  drafts: Readonly<Record<string, string>>;
}>;

const valid = (value: unknown): value is "f" | "c" | "i" =>
  value === "f" || value === "c" || value === "i";

/** Build or rebase a draft on the latest server-confirmed snapshot.
 * Keep only answers explicitly edited against the previous baseline.
 * A different identity, consent epoch or topic ALWAYS discards old drafts.
 */
export function rebaseTopicDrafts(
  previous: TopicDraftState | null,
  scope: string,
  questions: readonly TopicDraftQuestion[],
): TopicDraftState {
  const confirmed: Record<string, string | null> = Object.create(null);
  const drafts: Record<string, string> = Object.create(null);
  const sameScope = !!scope && previous?.scope === scope;

  for (const question of questions) {
    const saved = valid(question.userAnswer) ? question.userAnswer : null;
    confirmed[question.id] = saved;

    const oldSaved = sameScope && Object.prototype.hasOwnProperty.call(previous!.confirmed, question.id)
      ? previous!.confirmed[question.id] : undefined;
    const oldDraft = sameScope ? previous!.drafts[question.id] : undefined;
    const hasLocalEdit = oldSaved !== undefined && valid(oldDraft) && oldDraft !== oldSaved;
    const choice = hasLocalEdit ? oldDraft : saved;
    if (valid(choice)) drafts[question.id] = choice;
  }
  return { scope, confirmed, drafts };
}
