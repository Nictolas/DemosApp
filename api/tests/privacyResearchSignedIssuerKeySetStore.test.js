const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  MAX_SNAPSHOT_VALIDITY_MS,
  serializeIssuerKeySetPayload,
  createResearchSignedIssuerKeySetStore
} = require('../services/researchSignedIssuerKeySetStore');

const makePublicMaterial = (byte) => Buffer.alloc(96, byte);
const tokenKeyId = (publicKeyBytes) =>
  crypto.createHash('sha256').update(publicKeyBytes).digest().toString('base64url');

const makePayload = ({ sequence, issuedAt, expiresAt, entries }) => ({
  version: 1,
  sequence,
  issuedAt,
  expiresAt,
  keys: entries.map(({ bytes, epochs }) => ({
    tokenKeyId: tokenKeyId(bytes),
    publicKey: bytes.toString('base64url'),
    epochs
  }))
});

const signSnapshot = (payload, privateKey) => ({
  payload,
  signature: crypto.sign(null, serializeIssuerKeySetPayload(payload), privateKey).toString('base64url')
});

const makeLoader = (keysByMaterial) => async (bytes) => {
  const key = keysByMaterial.get(bytes.toString('base64url'));
  if (!key) throw new Error('Unknown fixture public key');
  return key;
};

test('signed issuer key-set installs atomically and resolves only authenticated epoch-scoped public keys', async () => {
  const { publicKey: trustRoot, privateKey } = crypto.generateKeyPairSync('ed25519');
  let now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const oldBytes = makePublicMaterial(1);
  const newBytes = makePublicMaterial(2);
  const oldKey = { type: 'public', usages: ['verify'], label: 'old' };
  const newKey = { type: 'public', usages: ['verify'], label: 'new' };
  const keysByMaterial = new Map([
    [oldBytes.toString('base64url'), oldKey],
    [newBytes.toString('base64url'), newKey]
  ]);
  const store = createResearchSignedIssuerKeySetStore({
    trustRootPublicKey: trustRoot,
    loadVerificationKey: makeLoader(keysByMaterial),
    now: () => now
  });

  assert.deepEqual(store.readiness(), { ready: false, reason: 'missing' });

  const payload = makePayload({
    sequence: 41,
    issuedAt: now - 60_000,
    expiresAt: now + 60 * 60 * 1000,
    entries: [
      { bytes: oldBytes, epochs: ['2026-Q4'] },
      { bytes: newBytes, epochs: ['2026-Q4', '2027-Q1'] }
    ]
  });
  const installed = await store.install(signSnapshot(payload, privateKey));

  assert.equal(installed.sequence, 41);
  assert.equal(store.readiness().ready, true);
  assert.equal(store.resolve({
    tokenKeyId: Buffer.from(tokenKeyId(oldBytes), 'base64url'),
    epoch: '2026-Q4'
  }), oldKey);
  assert.equal(store.resolve({
    tokenKeyId: Buffer.from(tokenKeyId(oldBytes), 'base64url'),
    epoch: '2027-Q1'
  }), null);
  assert.equal(store.resolve({
    tokenKeyId: Buffer.from(tokenKeyId(newBytes), 'base64url'),
    epoch: '2027-Q1'
  }), newKey);

  now = payload.expiresAt;
  assert.deepEqual(store.readiness(), { ready: false, reason: 'expired' });
  assert.equal(store.resolve({
    tokenKeyId: Buffer.from(tokenKeyId(newBytes), 'base64url'),
    epoch: '2027-Q1'
  }), null);
});

test('tampering, rollback and invalid replacement fail closed without replacing the current valid snapshot', async () => {
  const { publicKey: trustRoot, privateKey } = crypto.generateKeyPairSync('ed25519');
  const now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const firstBytes = makePublicMaterial(3);
  const secondBytes = makePublicMaterial(4);
  const firstKey = { type: 'public', usages: ['verify'], label: 'first' };
  const secondKey = { type: 'public', usages: ['verify'], label: 'second' };
  const store = createResearchSignedIssuerKeySetStore({
    trustRootPublicKey: trustRoot,
    loadVerificationKey: makeLoader(new Map([
      [firstBytes.toString('base64url'), firstKey],
      [secondBytes.toString('base64url'), secondKey]
    ])),
    now: () => now
  });

  const firstPayload = makePayload({
    sequence: 7,
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    entries: [{ bytes: firstBytes, epochs: ['2026-Q4'] }]
  });
  await store.install(signSnapshot(firstPayload, privateKey));

  const tamperedPayload = makePayload({
    sequence: 8,
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    entries: [{ bytes: secondBytes, epochs: ['2026-Q4'] }]
  });
  const tampered = signSnapshot(tamperedPayload, privateKey);
  tampered.payload.keys[0].epochs = ['2027-Q1'];
  await assert.rejects(store.install(tampered), /signature/i);

  await assert.rejects(
    store.install(signSnapshot(firstPayload, privateKey)),
    /rollback|replay/i
  );

  assert.equal(store.readiness().sequence, 7);
  assert.equal(store.resolve({
    tokenKeyId: Buffer.from(tokenKeyId(firstBytes), 'base64url'),
    epoch: '2026-Q4'
  }), firstKey);
  assert.equal(store.resolve({
    tokenKeyId: Buffer.from(tokenKeyId(secondBytes), 'base64url'),
    epoch: '2026-Q4'
  }), null);
});

test('snapshot validity window and trust root are bounded and verification-only', async () => {
  const { publicKey: trustRoot, privateKey } = crypto.generateKeyPairSync('ed25519');
  const now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const bytes = makePublicMaterial(5);
  const store = createResearchSignedIssuerKeySetStore({
    trustRootPublicKey: trustRoot,
    loadVerificationKey: async () => ({ type: 'public', usages: ['verify'] }),
    now: () => now
  });

  const tooLong = makePayload({
    sequence: 1,
    issuedAt: now,
    expiresAt: now + MAX_SNAPSHOT_VALIDITY_MS + 1,
    entries: [{ bytes, epochs: ['2026-Q4'] }]
  });
  assert.throws(() => serializeIssuerKeySetPayload(tooLong), /validity window/i);

  const expired = makePayload({
    sequence: 1,
    issuedAt: now - 10_000,
    expiresAt: now - 1,
    entries: [{ bytes, epochs: ['2026-Q4'] }]
  });
  await assert.rejects(store.install(signSnapshot(expired, privateKey)), /expired/i);

  assert.throws(() => createResearchSignedIssuerKeySetStore({
    trustRootPublicKey: privateKey,
    loadVerificationKey: async () => ({ type: 'public', usages: ['verify'] })
  }), /public key|public key material|public/i);
});

test('issuer key-set epoch scopes are bounded, canonical and duplicate-free', () => {
  const { privateKey } = crypto.generateKeyPairSync('ed25519');
  const now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const bytes = makePublicMaterial(6);
  const base = makePayload({
    sequence: 1,
    issuedAt: now,
    expiresAt: now + 60_000,
    entries: [{ bytes, epochs: ['2026-Q4'] }]
  });

  for (const invalidEpoch of ['', 'x'.repeat(65), '2026 Q4', '2026/Q4', 42, null]) {
    const payload = structuredClone(base);
    payload.keys[0].epochs = [invalidEpoch];
    assert.throws(
      () => serializeIssuerKeySetPayload(payload),
      /epoch scope/i
    );
  }

  const duplicate = structuredClone(base);
  duplicate.keys[0].epochs = ['2026-Q4', '2026-Q4'];
  assert.throws(
    () => serializeIssuerKeySetPayload(duplicate),
    /duplicate.*epoch scope/i
  );

  const canonicalA = structuredClone(base);
  canonicalA.keys[0].epochs = ['2027-Q1', '2026-Q4'];
  const canonicalB = structuredClone(base);
  canonicalB.keys[0].epochs = ['2026-Q4', '2027-Q1'];
  assert.deepEqual(
    serializeIssuerKeySetPayload(canonicalA),
    serializeIssuerKeySetPayload(canonicalB)
  );
  assert.equal(
    crypto.sign(null, serializeIssuerKeySetPayload(canonicalA), privateKey).length,
    64
  );
});

test('signed key-set store has no request-time Identity or network dependency', () => {
  const source = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchSignedIssuerKeySetStore.js'),
    'utf8'
  );
  assert.doesNotMatch(source, /axios|jsonwebtoken|middleware\/auth|requireAuth|authenticate/);
  assert.doesNotMatch(source, /\bfetch\s*\(|https?:\/\//);
  assert.doesNotMatch(source, /process\.env/);
});


test('issuer key-set epoch scope normalization rejects control characters and non-ASCII ambiguity', () => {
  const now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const bytes = makePublicMaterial(7);
  const base = makePayload({
    sequence: 2,
    issuedAt: now,
    expiresAt: now + 60_000,
    entries: [{ bytes, epochs: ['2026-Q4'] }]
  });

  for (const invalidEpoch of ['2026-Q4\\n', '2026-Q4\\t', '2026–Q4', 'époque']) {
    const payload = structuredClone(base);
    payload.keys[0].epochs = [invalidEpoch];
    assert.throws(
      () => serializeIssuerKeySetPayload(payload),
      /epoch scope/i
    );
  }
});

test('issuer key-set canonical epoch ordering is deterministic across multiple scopes', () => {
  const now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const bytes = makePublicMaterial(8);
  const first = makePayload({
    sequence: 3,
    issuedAt: now,
    expiresAt: now + 60_000,
    entries: [{ bytes, epochs: ['z:9', 'A.1', 'm_2', 'B-3'] }]
  });
  const second = structuredClone(first);
  second.keys[0].epochs = ['B-3', 'm_2', 'z:9', 'A.1'];

  assert.deepEqual(
    serializeIssuerKeySetPayload(first),
    serializeIssuerKeySetPayload(second)
  );
});
