export interface CapacitorRuntimeProbe {
  isNativePlatform(): boolean;
  getPlatform(): string;
}

export const assertNativeAndroidSecureStorageRuntime = (runtime: CapacitorRuntimeProbe): void => {
  if (!runtime.isNativePlatform() || runtime.getPlatform() !== 'android') {
    throw new Error('Secure opinion key storage requires native Android');
  }
};
