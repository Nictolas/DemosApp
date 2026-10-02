import type { MatchVector } from './localPoliticalMatcher';
import { validateLocalOpinionVector } from './localOpinionVault';

const CIPHERTEXT_KEY = 'demos.encrypted-opinion-vault.v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const toBase64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromBase64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

export interface DeviceOpinionVaultKeyProvider {
  getOrCreateKey(): Promise<CryptoKey>;
  getExistingKey(): Promise<CryptoKey | null>;
  clearKey(): Promise<void>;
}

const requireCrypto = (): SubtleCrypto => {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto unavailable');
  return globalThis.crypto.subtle;
};

export const createEncryptedOpinionVault = ({
  storage = globalThis.localStorage,
  keyProvider
}: {
  storage?: Storage;
  keyProvider: DeviceOpinionVaultKeyProvider;
}) => ({
  async write(vector: MatchVector): Promise<void> {
    const validated = validateLocalOpinionVector(vector);
    const key = await keyProvider.getOrCreateKey();
    const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
    const ciphertext = await requireCrypto().encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(JSON.stringify(validated))
    );
    storage.setItem(CIPHERTEXT_KEY, JSON.stringify({
      version: 1,
      algorithm: 'AES-GCM',
      iv: toBase64(iv),
      ciphertext: toBase64(new Uint8Array(ciphertext))
    }));
  },

  async read(): Promise<MatchVector> {
    const raw = storage.getItem(CIPHERTEXT_KEY);
    if (!raw) throw new Error('Encrypted local opinion vector missing');
    const envelope = JSON.parse(raw);
    if (envelope?.version !== 1 || envelope?.algorithm !== 'AES-GCM' || typeof envelope.iv !== 'string' || typeof envelope.ciphertext !== 'string') {
      throw new Error('Invalid encrypted opinion envelope');
    }
    const key = await keyProvider.getExistingKey();
    if (!key) throw new Error('Device opinion key missing');
    const plaintext = await requireCrypto().decrypt(
      { name: 'AES-GCM', iv: fromBase64(envelope.iv) },
      key,
      fromBase64(envelope.ciphertext)
    );
    return validateLocalOpinionVector(JSON.parse(decoder.decode(plaintext)));
  },

  async clear(): Promise<void> {
    storage.removeItem(CIPHERTEXT_KEY);
    await keyProvider.clearKey();
  }
});

export const ENCRYPTED_OPINION_VAULT_STORAGE_KEY = CIPHERTEXT_KEY;
