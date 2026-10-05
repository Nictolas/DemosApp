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

test('runtime clock corruption after install makes readiness and resolution fail closed', async () => {
  const { publicKey: trustRoot, privateKey } = crypto.generateKeyPairSync('ed25519');
  const validNow = Date.UTC(2026, 9, 3, 14, 0, 0);
  let observedNow = validNow;
  const bytes = makePublicMaterial(45);
  const verificationKey = { type: 'public', usages: ['verify'], label: 'clock-safe' };
  const store = createResearchSignedIssuerKeySetStore({
    trustRootPublicKey: trustRoot,
    loadVerificationKey: async () => verificationKey,
    now: () => observedNow
  });
  const payload = makePayload({
    sequence: 24,
    issuedAt: validNow - 1_000,
    expiresAt: validNow + 60_000,
    entries: [{ bytes, epochs: ['2026-Q4'] }]
  });
  await store.install(signSnapshot(payload, privateKey));

  observedNow = Number.NaN;
  assert.deepEqual(store.readiness(), { ready: false, reason: 'invalid-clock' });
  assert.equal(store.resolve({
    tokenKeyId: Buffer.from(tokenKeyId(bytes), 'base64url'),
    epoch: '2026-Q4'
  }), null);

  observedNow = Number.MAX_SAFE_INTEGER + 1;
  assert.deepEqual(store.readiness(), { ready: false, reason: 'invalid-clock' });
  assert.equal(store.resolve({
    tokenKeyId: Buffer.from(tokenKeyId(bytes), 'base64url'),
    epoch: '2026-Q4'
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


test('issuer key-set rejects excessive epoch fan-out per verification key', () => {
  const now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const bytes = makePublicMaterial(9);
  const payload = makePayload({
    sequence: 4,
    issuedAt: now,
    expiresAt: now + 60_000,
    entries: [{
      bytes,
      epochs: Array.from({ length: 9 }, (_, index) => `epoch-${index + 1}`)
    }]
  });

  assert.throws(
    () => serializeIssuerKeySetPayload(payload),
    /epoch scope/i
  );
});

test('issuer key-set accepts the bounded maximum of eight unique canonical epochs', () => {
  const now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const bytes = makePublicMaterial(10);
  const epochs = Array.from({ length: 8 }, (_, index) => `epoch-${index + 1}`);
  const payload = makePayload({
    sequence: 5,
    issuedAt: now,
    expiresAt: now + 60_000,
    entries: [{ bytes, epochs: [...epochs].reverse() }]
  });

  const serialized = serializeIssuerKeySetPayload(payload);
  assert.ok(Buffer.isBuffer(serialized));
  assert.ok(serialized.length > 0);
});


test('issuer key-set enforces the total verification-key snapshot bound', () => {
  const now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const entries = (count) => Array.from({ length: count }, (_, index) => ({
    bytes: makePublicMaterial(index + 11),
    epochs: ['2026-Q4']
  }));
  const payload = (count, sequence) => makePayload({
    sequence,
    issuedAt: now,
    expiresAt: now + 60_000,
    entries: entries(count)
  });

  assert.doesNotThrow(() => serializeIssuerKeySetPayload(payload(16, 6)));
  assert.throws(() => serializeIssuerKeySetPayload(payload(17, 7)), /issuer key-set keys/i);
});


test('failed verification-key loading leaves the previously authenticated snapshot intact', async () => {
  const { publicKey: trustRoot, privateKey } = crypto.generateKeyPairSync('ed25519');
  const now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const stableBytes = makePublicMaterial(40);
  const candidateBytes = makePublicMaterial(41);
  const stableKey = { type: 'public', usages: ['verify'], label: 'stable' };
  const store = createResearchSignedIssuerKeySetStore({
    trustRootPublicKey: trustRoot,
    loadVerificationKey: async (bytes) => {
      if (bytes.equals(stableBytes)) return stableKey;
      throw new Error('fixture loader failure');
    },
    now: () => now
  });

  const stablePayload = makePayload({
    sequence: 20,
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    entries: [{ bytes: stableBytes, epochs: ['2026-Q4'] }]
  });
  await store.install(signSnapshot(stablePayload, privateKey));

  const replacement = makePayload({
    sequence: 21,
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    entries: [{ bytes: candidateBytes, epochs: ['2027-Q1'] }]
  });
  await assert.rejects(store.install(signSnapshot(replacement, privateKey)), /loader failure/i);

  assert.equal(store.readiness().sequence, 20);
  assert.equal(store.resolve({
    tokenKeyId: Buffer.from(tokenKeyId(stableBytes), 'base64url'),
    epoch: '2026-Q4'
  }), stableKey);
  assert.equal(store.resolve({
    tokenKeyId: Buffer.from(tokenKeyId(candidateBytes), 'base64url'),
    epoch: '2027-Q1'
  }), null);
});

test('issuer key-set canonicalization is deterministic across key ordering', () => {
  const now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const firstBytes = makePublicMaterial(42);
  const secondBytes = makePublicMaterial(43);
  const first = makePayload({
    sequence: 22,
    issuedAt: now,
    expiresAt: now + 60_000,
    entries: [
      { bytes: firstBytes, epochs: ['2026-Q4'] },
      { bytes: secondBytes, epochs: ['2027-Q1'] }
    ]
  });
  const second = makePayload({
    sequence: 22,
    issuedAt: now,
    expiresAt: now + 60_000,
    entries: [
      { bytes: secondBytes, epochs: ['2027-Q1'] },
      { bytes: firstBytes, epochs: ['2026-Q4'] }
    ]
  });

  assert.deepEqual(
    serializeIssuerKeySetPayload(first),
    serializeIssuerKeySetPayload(second)
  );
});

test('issuer key-set rejects duplicate verification keys before installation', () => {
  const now = Date.UTC(2026, 9, 3, 14, 0, 0);
  const bytes = makePublicMaterial(44);
  const payload = makePayload({
    sequence: 23,
    issuedAt: now,
    expiresAt: now + 60_000,
    entries: [
      { bytes, epochs: ['2026-Q4'] },
      { bytes, epochs: ['2027-Q1'] }
    ]
  });

  assert.throws(
    () => serializeIssuerKeySetPayload(payload),
    /duplicate issuer token key id/i
  );
});
