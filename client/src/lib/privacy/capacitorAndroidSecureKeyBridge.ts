import type { SecureKeyBridge } from './deviceOpinionKeyProvider';
import { assertNativeAndroidSecureStorageRuntime, type CapacitorRuntimeProbe } from './capacitorSecureKeyRuntime';

export interface SecureStoragePluginPort {
  get(key: string): Promise<unknown>;
  set(key: string, value: string): Promise<unknown>;
  remove(key: string): Promise<unknown>;
}

const normalizeStoredValue = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value && 'value' in value) {
    const nested = (value as { value?: unknown }).value;
    return nested == null ? null : String(nested);
  }
  throw new Error('Unexpected secure storage response');
};

export const createCapacitorAndroidSecureKeyBridge = ({
  runtime,
  plugin
}: {
  runtime: CapacitorRuntimeProbe;
  plugin: SecureStoragePluginPort;
}): SecureKeyBridge => ({
  async isAvailable() {
    try {
      assertNativeAndroidSecureStorageRuntime(runtime);
      return true;
    } catch {
      return false;
    }
  },
  async get(name) {
    assertNativeAndroidSecureStorageRuntime(runtime);
    return normalizeStoredValue(await plugin.get(name));
  },
  async set(name, value) {
    assertNativeAndroidSecureStorageRuntime(runtime);
    await plugin.set(name, value);
  },
  async remove(name) {
    assertNativeAndroidSecureStorageRuntime(runtime);
    await plugin.remove(name);
  }
});
