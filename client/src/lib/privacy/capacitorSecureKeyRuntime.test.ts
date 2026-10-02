import { describe, expect, it } from 'vitest';
import { assertNativeAndroidSecureStorageRuntime } from './capacitorSecureKeyRuntime';

describe('Capacitor secure key runtime guard', () => {
  it('accepts only native Android', () => {
    expect(() => assertNativeAndroidSecureStorageRuntime({isNativePlatform:()=>true,getPlatform:()=> 'android'})).not.toThrow();
  });
  it.each([
    [false,'web'],
    [true,'ios'],
    [false,'android']
  ])('rejects non-approved runtime', (native, platform) => {
    expect(() => assertNativeAndroidSecureStorageRuntime({isNativePlatform:()=>native,getPlatform:()=>platform})).toThrow(/native Android/);
  });
});
