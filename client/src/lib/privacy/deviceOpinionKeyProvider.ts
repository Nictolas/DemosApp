import type { DeviceOpinionVaultKeyProvider } from './encryptedOpinionVault';

export interface SecureKeyBridge {
  isAvailable(): Promise<boolean>;
  get(name: string): Promise<string | null>;
  set(name: string, value: string): Promise<void>;
  remove(name: string): Promise<void>;
}

const KEY_NAME = 'demos.opinion-vault.aes256.v1';
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const unb64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

const importKey = (encoded: string) =>
  crypto.subtle.importKey('raw', unb64(encoded), { name: 'AES-GCM' }, false, ['encrypt','decrypt']);

export const createSecureBridgeOpinionKeyProvider = (bridge: SecureKeyBridge): DeviceOpinionVaultKeyProvider => {
  const requireBridge = async () => {
    if (!await bridge.isAvailable()) throw new Error('Secure device key storage unavailable');
  };
  return {
    async getOrCreateKey() {
      await requireBridge();
      const existing = await bridge.get(KEY_NAME);
      if (existing) return importKey(existing);
      const raw = crypto.getRandomValues(new Uint8Array(32));
      await bridge.set(KEY_NAME, b64(raw));
      return importKey(b64(raw));
    },
    async getExistingKey() {
      await requireBridge();
      const existing = await bridge.get(KEY_NAME);
      return existing ? importKey(existing) : null;
    },
    async clearKey() {
      await requireBridge();
      await bridge.remove(KEY_NAME);
    }
  };
};

export const createUnavailableOpinionKeyProvider = (): DeviceOpinionVaultKeyProvider => ({
  async getOrCreateKey() { throw new Error('Secure device key storage unavailable'); },
  async getExistingKey() { throw new Error('Secure device key storage unavailable'); },
  async clearKey() { throw new Error('Secure device key storage unavailable'); }
});

export const DEVICE_OPINION_KEY_NAME = KEY_NAME;
