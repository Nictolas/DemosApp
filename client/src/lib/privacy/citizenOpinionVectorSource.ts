import type { MatchVector } from './localPoliticalMatcher';
import type { OpinionVault } from './opinionVaultBootstrap';
import { readOrBootstrapOpinionVault } from './opinionVaultBootstrap';
import type { OpinionVaultCutoverPolicy } from './opinionVaultCutoverPolicy';

export type CitizenOpinionVectorSource = Readonly<{
  vector: MatchVector;
  source: 'vault' | 'legacy-import';
}>;

export const createCitizenOpinionVectorSource = ({
  vault,
  policy,
  fetchLegacyOpinions
}: {
  vault: OpinionVault;
  policy: OpinionVaultCutoverPolicy;
  fetchLegacyOpinions: () => Promise<MatchVector>;
}) => ({
  async read(): Promise<CitizenOpinionVectorSource> {
    const result = await readOrBootstrapOpinionVault({ vault, policy, fetchLegacyOpinions });
    return Object.freeze({ vector: result.vector, source: result.source });
  }
});
