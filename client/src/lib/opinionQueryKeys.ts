/** React Query keys for account-specific political opinions. No persistence or I/O. */
export const OPINION_QUESTIONS_PREFIX = 'opinioniQuestions' as const;

export function opinionQuestionsKey(grade: string, accountId: string | null | undefined) {
  return [OPINION_QUESTIONS_PREFIX, grade, accountId ?? null] as const;
}

export function purgePersonalOpinionCache(client: {
  cancelQueries: (filters: { queryKey: readonly string[] }) => Promise<unknown> | void;
  removeQueries: (filters: { queryKey: readonly string[] }) => void;
}): void {
  // Prefix matches all grades, accounts and old unscoped cache entries.
  const filters = { queryKey: [OPINION_QUESTIONS_PREFIX] as readonly string[] };
  // Cancel active requests before removing their cached results. Query functions
  // must consume React Query's AbortSignal to abort their underlying fetch.
  void client.cancelQueries(filters);
  client.removeQueries(filters);
}
