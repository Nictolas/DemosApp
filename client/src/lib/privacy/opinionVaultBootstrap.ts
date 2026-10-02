import type { MatchVector } from './localPoliticalMatcher';
import type { OpinionVaultCutoverPolicy } from './opinionVaultCutoverPolicy';

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
  policy
}: {
  vault: OpinionVault;
  fetchLegacyOpinions: LegacyOpinionFetcher;
  policy: OpinionVaultCutoverPolicy;
}): Promise<OpinionVaultBootstrapResult> => {
  try {
    return { source: 'vault', vector: await vault.read() };
  } catch (vaultError) {
    if (!policy.allowLegacyImport) throw vaultError;
  }

  const vector = await fetchLegacyOpinions();
  if (!vector || typeof vector !== 'object' || Array.isArray(vector)) {
    throw new Error('Legacy opinion vector unavailable');
  }
  await vault.write(vector);
  return { source: 'legacy-import', vector };
};
