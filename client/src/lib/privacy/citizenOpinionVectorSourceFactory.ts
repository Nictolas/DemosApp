import type { MatchVector } from './localPoliticalMatcher';
import type { CapacitorRuntimeProbe } from './capacitorSecureKeyRuntime';
import { createCapacitorAndroidSecureKeyBridge, type AparajitaSecureStorageV6Port } from './capacitorAndroidSecureKeyBridge';
import { createSecureBridgeOpinionKeyProvider } from './deviceOpinionKeyProvider';
import { createEncryptedOpinionVault } from './encryptedOpinionVault';
import { createCitizenOpinionVectorSource } from './citizenOpinionVectorSource';
import type { OpinionVaultCutoverPolicy } from './opinionVaultCutoverPolicy';

export const createNativeAndroidCitizenOpinionVectorSource = ({
  runtime,
  secureStorage,
  storage,
  policy,
  fetchLegacyOpinions
}: {
  runtime: CapacitorRuntimeProbe;
  secureStorage: AparajitaSecureStorageV6Port;
  storage: Storage;
  policy: OpinionVaultCutoverPolicy;
  fetchLegacyOpinions: () => Promise<MatchVector>;
}) => {
  const bridge = createCapacitorAndroidSecureKeyBridge({ runtime, plugin: secureStorage });
  const keyProvider = createSecureBridgeOpinionKeyProvider(bridge);
  const vault = createEncryptedOpinionVault({ storage, keyProvider });
  return createCitizenOpinionVectorSource({ vault, policy, fetchLegacyOpinions });
};
