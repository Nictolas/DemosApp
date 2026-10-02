import type { MatchVector } from './localPoliticalMatcher';

export interface OpinionVault {
  read(): Promise<MatchVector>;
  write(vector: MatchVector): Promise<void>;
}

export type LegacyOpinionFetcher = () => Promise<MatchVector>;

export type OpinionVaultBootstrapResult =
  | { source: 'vault'; vector: MatchVector }
  | { source: 'legacy-import'; vector: MatchVector };

export const readOrBootstrapOpinionVault = async ({
  vault,
  fetchLegacyOpinions,
  allowLegacyImport = false
}: {
  vault: OpinionVault;
  fetchLegacyOpinions: LegacyOpinionFetcher;
  allowLegacyImport?: boolean;
}): Promise<OpinionVaultBootstrapResult> => {
  try {
    return { source: 'vault', vector: await vault.read() };
  } catch (vaultError) {
    if (!allowLegacyImport) throw vaultError;
  }

  const vector = await fetchLegacyOpinions();
  if (!vector || typeof vector !== 'object' || Array.isArray(vector)) {
    throw new Error('Legacy opinion vector unavailable');
  }
  await vault.write(vector);
  return { source: 'legacy-import', vector };
};
