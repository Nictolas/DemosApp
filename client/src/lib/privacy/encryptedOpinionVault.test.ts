import { beforeEach, describe, expect, it } from 'vitest';
import { createEncryptedOpinionVault, ENCRYPTED_OPINION_VAULT_STORAGE_KEY, DeviceOpinionVaultKeyProvider } from './encryptedOpinionVault';

const provider = (): DeviceOpinionVaultKeyProvider & { key: CryptoKey | null } => ({
  key: null,
  async getOrCreateKey() {
    if (!this.key) this.key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
    return this.key;
  },
  async getExistingKey() { return this.key; },
  async clearKey() { this.key = null; }
});

describe('encryptedOpinionVault', () => {
  beforeEach(() => localStorage.clear());

  it('stores ciphertext, not political plaintext', async () => {
    const vault = createEncryptedOpinionVault({ keyProvider: provider() });
    await vault.write({ taxation: 'increase', q2: 2 });
    const raw = localStorage.getItem(ENCRYPTED_OPINION_VAULT_STORAGE_KEY) || '';
    expect(raw).not.toContain('increase');
    expect(raw).not.toContain('taxation');
    expect(await vault.read()).toEqual({ taxation: 'increase', q2: 2 });
  });

  it('fails closed when device key is unavailable', async () => {
    const first = provider();
    const vault = createEncryptedOpinionVault({ keyProvider: first });
    await vault.write({ q1: true });
    const second = provider();
    await expect(createEncryptedOpinionVault({ keyProvider: second }).read()).rejects.toThrow(/key missing/);
  });

  it('detects ciphertext tampering through AES-GCM authentication', async () => {
    const keys = provider();
    const vault = createEncryptedOpinionVault({ keyProvider: keys });
    await vault.write({ q1: 2 });
    const env = JSON.parse(localStorage.getItem(ENCRYPTED_OPINION_VAULT_STORAGE_KEY)!);
    env.ciphertext = env.ciphertext.slice(0, -2) + 'AA';
    localStorage.setItem(ENCRYPTED_OPINION_VAULT_STORAGE_KEY, JSON.stringify(env));
    await expect(vault.read()).rejects.toThrow();
  });
});
