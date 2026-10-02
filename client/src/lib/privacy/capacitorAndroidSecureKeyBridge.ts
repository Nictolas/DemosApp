import type { SecureKeyBridge } from './deviceOpinionKeyProvider';
import { assertNativeAndroidSecureStorageRuntime, type CapacitorRuntimeProbe } from './capacitorSecureKeyRuntime';

export interface AparajitaSecureStorageV6Port {
  get(key: string, convertDate?: boolean, sync?: boolean): Promise<string | null>;
  set(key: string, data: string, convertDate?: boolean, sync?: boolean): Promise<void>;
  remove(key: string, sync?: boolean): Promise<boolean>;
}

const normalizeStoredValue = (value: unknown): string | null => {
  if (value == null) return null;
  if (typeof value === 'string') return value;
  throw new Error('Unexpected secure storage response');
};

export const createCapacitorAndroidSecureKeyBridge = ({
  runtime,
  plugin
}: {
  runtime: CapacitorRuntimeProbe;
  plugin: AparajitaSecureStorageV6Port;
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
