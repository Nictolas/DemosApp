const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('node:fs');
const path = require('node:path');

const {
  createResearchPrivacyPassPublicKeyLoader
} = require('../services/researchPrivacyPassPublicKeyLoader');
const {
  MAX_SNAPSHOT_JSON_BYTES,
  parseResearchSignedIssuerKeySetSnapshot,
  createResearchPrivacyPassKeySetBootstrap
} = require('../services/researchPrivacyPassKeySetBootstrap');
const {
  serializeIssuerKeySetPayload
} = require('../services/researchSignedIssuerKeySetStore');

const sha256 = (value) => crypto.createHash('sha256').update(value).digest();
const makeVerificationKey = () => ({
  type: 'public',
  usages: ['verify'],
  extractable: false,
  algorithm: { name: 'RSA-PSS', hash: { name: 'SHA-384' } }
});

const makePrivacyPass = ({ importedKey, keyId }) => {
  class Origin {
    createTokenChallenge() {
      return { serialize: () => Buffer.from('research-keyset-bootstrap-challenge') };
    }

    async verify(_token, key) {
      return key === importedKey;
    }
  }

  return {
    Token: {
      deserialize() {
        return {
          authInput: {
            tokenKeyId: keyId,
            challengeDigest: sha256(Buffer.from('research-keyset-bootstrap-challenge'))
          }
        };
      }
    },
    publicVerif: {
      convertRSASSAPSSToEnc: (bytes) => Uint8Array.from(bytes),
      BLIND_RSA: {
        value: 2,
        rsaParams: { name: 'RSA-PSS', hash: 'SHA-384' }
      },
      BlindRSAMode: { PSS: 48 },
      Origin,
      getPublicKeyBytes: async () => Buffer.alloc(96, 7)
    }
  };
};

test('Privacy Pass public-key loader imports only non-extractable RSA-PSS SHA-384 verification keys', async () => {
  const importedKey = makeVerificationKey();
  const calls = [];
  const subtle = {
    async importKey(...args) {
      calls.push(args);
      return importedKey;
    }
  };
  const privacyPass = makePrivacyPass({
    importedKey,
    keyId: Buffer.alloc(32, 1)
  });
  const loader = createResearchPrivacyPassPublicKeyLoader({ privacyPass, subtle });
  const input = Buffer.alloc(96, 9);

  assert.equal(await loader(input), importedKey);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], 'spki');
  assert.deepEqual(calls[0][2], { name: 'RSA-PSS', hash: 'SHA-384' });
  assert.equal(calls[0][3], false);
  assert.deepEqual(calls[0][4], ['verify']);
});

test('Privacy Pass public-key loader fails closed for unexpected algorithms, malformed bytes and non-public imports', async () => {
  const importedKey = makeVerificationKey();
  const privacyPass = makePrivacyPass({ importedKey, keyId: Buffer.alloc(32, 1) });

  assert.throws(() => createResearchPrivacyPassPublicKeyLoader({
    privacyPass: {
      ...privacyPass,
      publicVerif: {
        ...privacyPass.publicVerif,
        BLIND_RSA: { value: 2, rsaParams: { name: 'RSA-OAEP', hash: 'SHA-384' } }
      }
    },
    subtle: { importKey: async () => importedKey }
  }), /algorithm/i);

  const loader = createResearchPrivacyPassPublicKeyLoader({
    privacyPass,
    subtle: { importKey: async () => importedKey }
  });
  await assert.rejects(() => loader(Buffer.alloc(8)), /public-key bytes/i);

  const privateLoader = createResearchPrivacyPassPublicKeyLoader({
    privacyPass,
    subtle: {
      importKey: async () => ({
        type: 'private',
        usages: ['sign'],
        algorithm: { name: 'RSA-PSS', hash: { name: 'SHA-384' } }
      })
    }
  });
  await assert.rejects(() => privateLoader(Buffer.alloc(96, 2)), /public|verification/i);
});

test('authenticated local key-set bootstrap enforces freshness and fails closed before expiry', async () => {
  const { publicKey: trustRoot, privateKey } = crypto.generateKeyPairSync('ed25519');
  let now = Date.UTC(2026, 9, 3, 15, 0, 0);
  const publicKeyBytes = Buffer.alloc(96, 7);
  const keyId = sha256(publicKeyBytes);
  const importedKey = makeVerificationKey();
  const privacyPass = makePrivacyPass({ importedKey, keyId });
  const subtle = { importKey: async () => importedKey };
  const payload = {
    version: 1,
    sequence: 12,
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    keys: [{
      tokenKeyId: keyId.toString('base64url'),
      publicKey: publicKeyBytes.toString('base64url'),
      epochs: ['2026-Q4']
    }]
  };
  const snapshot = {
    payload,
    signature: crypto.sign(
      null,
      serializeIssuerKeySetPayload(payload),
      privateKey
    ).toString('base64url')
  };

  await assert.rejects(
    () => createResearchPrivacyPassKeySetBootstrap({
      privacyPass,
      trustRootPublicKey: trustRoot,
      signedSnapshotJson: JSON.stringify(snapshot),
      minimumRemainingValidityMs: 0,
      subtle,
      now: () => now
    }),
    /freshness margin/i
  );

  const bootstrap = await createResearchPrivacyPassKeySetBootstrap({
    privacyPass,
    trustRootPublicKey: trustRoot,
    signedSnapshotJson: JSON.stringify(snapshot),
    minimumRemainingValidityMs: 10_000,
    subtle,
    now: () => now
  });

  assert.deepEqual(bootstrap.readiness(), {
    ready: true,
    sequence: 12,
    expiresAt: payload.expiresAt
  });
  assert.deepEqual(bootstrap.health(), { ready: true });
  assert.equal(bootstrap.usable(), true);
  assert.deepEqual(await bootstrap.credentialProvider.verify({
    credentialBytes: Buffer.from('opaque-credential'),
    purpose: 'renew',
    epoch: '2026-Q4'
  }), { valid: true, credentialVersion: 1 });

  const tampered = JSON.parse(JSON.stringify(snapshot));
  tampered.payload.sequence = 13;
  await assert.rejects(
    () => bootstrap.installSignedSnapshotJson(JSON.stringify(tampered)),
    /signature/i
  );
  assert.equal(bootstrap.readiness().sequence, 12);

  const nearExpiryPayload = {
    ...payload,
    sequence: 13,
    issuedAt: now - 1_000,
    expiresAt: now + 9_999
  };
  const nearExpirySnapshot = {
    payload: nearExpiryPayload,
    signature: crypto.sign(
      null,
      serializeIssuerKeySetPayload(nearExpiryPayload),
      privateKey
    ).toString('base64url')
  };
  await assert.rejects(
    () => bootstrap.installSignedSnapshotJson(JSON.stringify(nearExpirySnapshot)),
    /not fresh enough/i
  );
  assert.deepEqual(bootstrap.readiness(), {
    ready: true,
    sequence: 12,
    expiresAt: payload.expiresAt
  });
  assert.equal(bootstrap.usable(), true);

  now = payload.expiresAt - 9_999;
  assert.deepEqual(bootstrap.readiness(), {
    ready: false,
    reason: 'freshness-window',
    sequence: 12,
    expiresAt: payload.expiresAt
  });
  assert.deepEqual(bootstrap.health(), {
    ready: false,
    reason: 'freshness-window'
  });
  assert.equal(bootstrap.usable(), false);
  assert.deepEqual(await bootstrap.credentialProvider.verify({
    credentialBytes: Buffer.from('opaque-credential'),
    purpose: 'renew',
    epoch: '2026-Q4'
  }), { valid: false });

  now = payload.expiresAt;
  assert.deepEqual(bootstrap.readiness(), { ready: false, reason: 'expired' });
  assert.deepEqual(bootstrap.health(), { ready: false, reason: 'expired' });
  assert.equal(bootstrap.usable(), false);
  assert.deepEqual(await bootstrap.credentialProvider.verify({
    credentialBytes: Buffer.from('opaque-credential'),
    purpose: 'renew',
    epoch: '2026-Q4'
  }), { valid: false });
});

test('local key-set bootstrap parser bounds input and shadow composition has no Identity/network dependency', () => {
  assert.throws(
    () => parseResearchSignedIssuerKeySetSnapshot('{'),
    /JSON/i
  );
  assert.throws(
    () => parseResearchSignedIssuerKeySetSnapshot(Buffer.alloc(MAX_SNAPSHOT_JSON_BYTES + 1, 1)),
    /size/i
  );

  const bootstrapSource = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchPrivacyPassKeySetBootstrap.js'),
    'utf8'
  );
  const loaderSource = fs.readFileSync(
    path.join(__dirname, '..', 'services', 'researchPrivacyPassPublicKeyLoader.js'),
    'utf8'
  );
  const combined = `${bootstrapSource}\n${loaderSource}`;
  assert.doesNotMatch(combined, /DATABASE_URL|RESEARCH_DATABASE_URL|axios|fetch\s*\(|https?:\/\/|identityAuth|sessionService/);
});


test('persisted key-set recovery revalidates signature and freshness through the Privacy Pass bootstrap', async () => {
  const { publicKey: trustRoot, privateKey } = crypto.generateKeyPairSync('ed25519');
  const now = Date.UTC(2026, 9, 3, 16, 0, 0);
  const publicKeyBytes = Buffer.alloc(96, 7);
  const keyId = sha256(publicKeyBytes);
  const importedKey = makeVerificationKey();
  const privacyPass = makePrivacyPass({ importedKey, keyId });
  const payload = {
    version: 1,
    sequence: 21,
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    keys: [{
      tokenKeyId: keyId.toString('base64url'),
      publicKey: publicKeyBytes.toString('base64url'),
      epochs: ['2026-Q4']
    }]
  };
  const snapshotJson = JSON.stringify({
    payload,
    signature: crypto.sign(
      null,
      serializeIssuerKeySetPayload(payload),
      privateKey
    ).toString('base64url')
  });
  let revalidate;
  const persistence = {
    async recoverAuthenticatedSnapshot(options) {
      revalidate = options.revalidate;
      const validation = await revalidate(snapshotJson);
      assert.deepEqual(validation, {
        ready: true,
        sequence: 21,
        expiresAt: payload.expiresAt
      });
      return { snapshotJson, sequence: 21, expiresAt: payload.expiresAt };
    }
  };

  const { createResearchPrivacyPassKeySetBootstrapFromRecovery } =
    require('../services/researchPrivacyPassKeySetBootstrap');
  const bootstrap = await createResearchPrivacyPassKeySetBootstrapFromRecovery({
    persistence,
    privacyPass,
    trustRootPublicKey: trustRoot,
    minimumRemainingValidityMs: 10_000,
    subtle: { importKey: async () => importedKey },
    now: () => now
  });

  assert.equal(typeof revalidate, 'function');
  assert.deepEqual(bootstrap.readiness(), {
    ready: true,
    sequence: 21,
    expiresAt: payload.expiresAt
  });
  assert.equal(bootstrap.usable(), true);
  assert.deepEqual(await bootstrap.credentialProvider.verify({
    credentialBytes: Buffer.from('opaque-credential'),
    purpose: 'renew',
    epoch: '2026-Q4'
  }), { valid: true, credentialVersion: 1 });
});

test('recovery bootstrap fails closed when persistence cannot revalidate the snapshot', async () => {
  const { createResearchPrivacyPassKeySetBootstrapFromRecovery } =
    require('../services/researchPrivacyPassKeySetBootstrap');
  const importedKey = makeVerificationKey();
  const privacyPass = makePrivacyPass({
    importedKey,
    keyId: Buffer.alloc(32, 1)
  });
  const persistence = {
    async recoverAuthenticatedSnapshot({ revalidate }) {
      await assert.rejects(() => revalidate('{'), /JSON/i);
      throw new Error('Persisted issuer key-set snapshot failed restart revalidation');
    }
  };

  await assert.rejects(
    () => createResearchPrivacyPassKeySetBootstrapFromRecovery({
      persistence,
      privacyPass,
      trustRootPublicKey: crypto.generateKeyPairSync('ed25519').publicKey,
      minimumRemainingValidityMs: 10_000,
      subtle: { importKey: async () => importedKey }
    }),
    (error) => {
      assert.equal(error.message, 'Research issuer key-set recovery failed');
      assert.deepEqual(error.health, {
        ready: false,
        reason: 'recovery-failed'
      });
      assert.doesNotMatch(error.message, /snapshot|JSON|signature|sequence|tokenKeyId|publicKey|privateKey/i);
      return true;
    }
  );
});


test('recovery bootstrap minimizes post-recovery invariant failures to recovery-failed health', async () => {
  const { createResearchPrivacyPassKeySetBootstrapFromRecovery } =
    require('../services/researchPrivacyPassKeySetBootstrap');
  const { publicKey: trustRoot, privateKey } = crypto.generateKeyPairSync('ed25519');
  const now = Date.UTC(2026, 9, 3, 17, 0, 0);
  const publicKeyBytes = Buffer.alloc(96, 7);
  const keyId = sha256(publicKeyBytes);
  const importedKey = makeVerificationKey();
  const privacyPass = makePrivacyPass({ importedKey, keyId });
  const payload = {
    version: 1,
    sequence: 31,
    issuedAt: now - 1_000,
    expiresAt: now + 60_000,
    keys: [{
      tokenKeyId: keyId.toString('base64url'),
      publicKey: publicKeyBytes.toString('base64url'),
      epochs: ['2026-Q4']
    }]
  };
  const snapshotJson = JSON.stringify({
    payload,
    signature: crypto.sign(
      null,
      serializeIssuerKeySetPayload(payload),
      privateKey
    ).toString('base64url')
  });
  const persistence = {
    async recoverAuthenticatedSnapshot({ revalidate }) {
      await revalidate(snapshotJson);
      return { snapshotJson, sequence: 32, expiresAt: payload.expiresAt };
    }
  };

  await assert.rejects(
    () => createResearchPrivacyPassKeySetBootstrapFromRecovery({
      persistence,
      privacyPass,
      trustRootPublicKey: trustRoot,
      minimumRemainingValidityMs: 10_000,
      subtle: { importKey: async () => importedKey },
      now: () => now
    }),
    (error) => {
      assert.equal(error.message, 'Research issuer key-set recovery failed');
      assert.deepEqual(error.health, {
        ready: false,
        reason: 'recovery-failed'
      });
      assert.doesNotMatch(error.message, /mismatch|sequence|snapshot|JSON|signature/i);
      return true;
    }
  );

  const missingCandidatePersistence = {
    async recoverAuthenticatedSnapshot() {
      return { snapshotJson, sequence: 31, expiresAt: payload.expiresAt };
    }
  };
  await assert.rejects(
    () => createResearchPrivacyPassKeySetBootstrapFromRecovery({
      persistence: missingCandidatePersistence,
      privacyPass,
      trustRootPublicKey: trustRoot,
      minimumRemainingValidityMs: 10_000,
      subtle: { importKey: async () => importedKey },
      now: () => now
    }),
    (error) => {
      assert.equal(error.message, 'Research issuer key-set recovery failed');
      assert.deepEqual(error.health, {
        ready: false,
        reason: 'recovery-failed'
      });
      return true;
    }
  );
});
