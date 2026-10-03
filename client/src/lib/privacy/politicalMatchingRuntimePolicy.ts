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
