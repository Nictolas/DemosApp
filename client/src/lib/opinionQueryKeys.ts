/** React Query keys for account-specific political opinions. No persistence or I/O. */
export const OPINION_QUESTIONS_PREFIX = 'opinioniQuestions' as const;

export function opinionQuestionsKey(grade: string, accountId: string | null | undefined) {
  return [OPINION_QUESTIONS_PREFIX, grade, accountId ?? null] as const;
}

export function purgePersonalOpinionCache(client: {
  removeQueries: (filters: { queryKey: readonly string[] }) => void;
}): void {
  // Prefix matches all grades, accounts and old unscoped cache entries.
  client.removeQueries({ queryKey: [OPINION_QUESTIONS_PREFIX] });
}
