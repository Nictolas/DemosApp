import { isLocalPoliticalMatchingEnabled } from './researchPoliticalMatchingClient';
import { getOpinionVaultCutoverPolicy } from './opinionVaultCutoverPolicy';
import { resolvePoliticalMatchingRuntimeMode } from './politicalMatchingRuntimePolicy';

export const getLivePoliticalMatchingRuntimeMode = () => {
  const vaultPolicy = getOpinionVaultCutoverPolicy();
  return {
    mode: resolvePoliticalMatchingRuntimeMode({
      localMatchingEnabled: isLocalPoliticalMatchingEnabled(),
      vaultCutoverMode: vaultPolicy.mode
    }),
    vaultPolicy
  } as const;
};
