export type PoliticalMatchingRuntimeMode = 'legacy' | 'privacy-first';

export const resolvePoliticalMatchingRuntimeMode = ({
  localMatchingEnabled,
  vaultCutoverMode
}: {
  localMatchingEnabled: boolean;
  vaultCutoverMode: 'off' | 'bootstrap' | 'vault-only';
}): PoliticalMatchingRuntimeMode =>
  localMatchingEnabled && vaultCutoverMode !== 'off' ? 'privacy-first' : 'legacy';

export const assertNoPrivacyFallback = (
  mode: PoliticalMatchingRuntimeMode,
  error: unknown
): never => {
  if (mode === 'privacy-first') {
    throw error instanceof Error ? error : new Error('Privacy-first political matching failed');
  }
  throw new Error('Legacy matching fallback assertion used outside privacy-first mode');
};


export const runPoliticalMatchingRuntime = async <T>({
  mode,
  runLegacy,
  runPrivacyFirst
}: {
  mode: PoliticalMatchingRuntimeMode;
  runLegacy: () => Promise<T>;
  runPrivacyFirst: () => Promise<T>;
}): Promise<T> => {
  if (mode === 'privacy-first') {
    try {
      return await runPrivacyFirst();
    } catch (error) {
      return assertNoPrivacyFallback(mode, error);
    }
  }
  return runLegacy();
};
