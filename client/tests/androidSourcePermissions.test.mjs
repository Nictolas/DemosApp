import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = relative => readFileSync(new URL(relative, import.meta.url), 'utf8');

const manifest = read('../android/app/src/main/AndroidManifest.xml');
const filePaths = read('../android/app/src/main/res/xml/file_paths.xml');
const gradle = read('../android/app/build.gradle');
const capacitor = read('../capacitor.config.ts');

test('source Android manifest has only expected direct permissions', () => {
  const permissions = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)]
    .map(match => match[1]);
  assert.deepEqual(permissions, ['android.permission.INTERNET']);
});

test('Android app disables unencrypted traffic and operating-system backup', () => {
  assert.match(manifest, /android:allowBackup="false"/);
  assert.match(manifest, /android:usesCleartextTraffic="false"/);
  assert.match(capacitor, /androidScheme:\s*['"]https['"]/);
});

test('file provider remains private and limited to app cache', () => {
  const provider = manifest.match(/<provider\b[\s\S]*?<\/provider>/)?.[0];
  assert.ok(provider, 'expected FileProvider');
  assert.match(provider, /android:exported="false"/);
  assert.match(provider, /android:authorities="\$\{applicationId\}\.fileprovider"/);
  assert.match(filePaths, /<cache-path\s+name="shared_cache"\s+path="\."\s*\/>/);
  assert.doesNotMatch(filePaths, /<external-(?:files-)?path\b/i);
});

test('Android package and version remain explicit; no accidental downgrade', () => {
  assert.match(gradle, /applicationId\s+"community\.demos"/);
  const versionCode = Number(gradle.match(/\bversionCode\s+(\d+)/)?.[1]);
  assert.ok(Number.isInteger(versionCode) && versionCode >= 12);
  const versionName = gradle.match(/\bversionName\s+"([^"]+)"/)?.[1];
  assert.ok(versionName, 'missing versionName');
  if (versionCode === 12) {
    console.log('Pre-release warning: versionCode 12 is the existing Play Alpha; a new Play upload needs >12.');
  }
  console.log('Source manifest only: merged AAB manifest, Play Data Safety and device permissions still require separate checks.');
});
