import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  stablePlayIntegrityJson, createPlayIntegrityRequestHash
} from '../../client/src/lib/playIntegrityHash.ts';
import policy from '../services/playIntegrityPolicy.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

test('browser WebCrypto matches backend requestHash across canonical payloads', async () => {
  for (const [action, payload] of [
    ['profile_update', { surname: 'È un testo', flags: [true, false], count: 3 }],
    ['opinion_save', { items: [{ id: 4, answer: 2 }, { id: 9, answer: 1 }] }],
    ['session_start', { nested: { z: null, a: ['x', { y: 0 }] } }],
    ['registration', { district: 'Pisa', year: 2000 }]
  ]) {
    const client = await createPlayIntegrityRequestHash(action, payload);
    const server = policy.createRequestHash(action, payload);
    assert.equal(client, server);
    assert.match(client, /^[A-Za-z0-9_-]{43}$/);
  }
});

test('property ordering cannot change the digest on either side', async () => {
  const a = { z: 2, a: { y: true, x: false } };
  const b = { a: { x: false, y: true }, z: 2 };
  assert.equal(stablePlayIntegrityJson(a), stablePlayIntegrityJson(b));
  assert.equal(await createPlayIntegrityRequestHash('opinion_save', a),
    await createPlayIntegrityRequestHash('opinion_save', b));
});

test('unsafe payloads are rejected and do not generate a false trusted hash', async () => {
  assert.throws(() => stablePlayIntegrityJson({ invalid: undefined }));
  await assert.rejects(createPlayIntegrityRequestHash('Invalid action', { a: 1 }));
  assert.throws(() => stablePlayIntegrityJson(new Date()));
});

test('Android and web feature gates remain disabled with no release project id', () => {
  const gradle = fs.readFileSync(path.join(root, 'client/android/app/build.gradle'), 'utf8');
  const native = fs.readFileSync(path.join(root,
    'client/android/app/src/main/java/community/demos/NativePlayIntegrityPlugin.java'), 'utf8');
  const wrapper = fs.readFileSync(path.join(root, 'client/src/lib/nativePlayIntegrity.ts'), 'utf8');
  assert.match(gradle, /buildConfigField "boolean", "PLAY_INTEGRITY_ENABLED", "false"/);
  assert.match(gradle, /buildConfigField "long", "PLAY_INTEGRITY_PROJECT_NUMBER", "0L"/);
  assert.match(native, /if \(!isEnabled\(\)\) \{/);
  assert.match(wrapper, /VITE_PLAY_INTEGRITY_ENABLED !== 'true'/);
  assert.match(wrapper, /Capacitor\.isNativePlatform\(\)/);
});
