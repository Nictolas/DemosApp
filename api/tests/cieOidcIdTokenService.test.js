const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const {
  computeAtHash,
  verifyAcr,
  validateCieIdToken
} = require('../services/cieOidcIdTokenService');

const { privateKey: opPrivateKey, publicKey: opPublicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048
});
const { privateKey: rpPrivateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048
});

const OP_KID = 'op-test-kid';

function configure() {
  process.env.CIE_OIDC_ENABLED = 'true';
  process.env.CIE_RP_ENTITY_ID = 'https://demos.example/rp';
  process.env.CIE_OP_ISSUER = 'https://cie-op.example';
  process.env.CIE_OP_AUTHORIZATION_ENDPOINT = 'https://cie-op.example/authorize';
  process.env.CIE_OP_TOKEN_ENDPOINT = 'https://cie-op.example/token';
  process.env.CIE_REDIRECT_URI = 'https://demos.example/api/auth/cie/callback';
  process.env.CIE_RP_SIGNING_KID = 'rp-test-kid';
  process.env.CIE_RP_SIGNING_PRIVATE_KEY_B64 = Buffer
    .from(rpPrivateKey.export({ type: 'pkcs8', format: 'pem' }))
    .toString('base64');
  process.env.CIE_ACR_VALUES = 'https://www.spid.gov.it/SpidL2';
  process.env.CIE_ID_TOKEN_SIGNING_ALG = 'RS256';

  const jwk = opPublicKey.export({ format: 'jwk' });
  jwk.kid = OP_KID;
  jwk.use = 'sig';
  jwk.alg = 'RS256';
  process.env.CIE_OP_JWKS_B64 = Buffer.from(JSON.stringify({ keys: [jwk] })).toString('base64');
}

function makeIdToken({ accessToken, nonce, overrides = {} }) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: 'https://cie-op.example',
    sub: 'pairwise-subject',
    aud: 'https://demos.example/rp',
    acr: 'https://www.spid.gov.it/SpidL2',
    at_hash: computeAtHash(accessToken, 'RS256'),
    iat: now,
    nbf: now,
    exp: now + 300,
    jti: crypto.randomUUID(),
    nonce,
    ...overrides
  };

  return jwt.sign(payload, opPrivateKey, {
    algorithm: 'RS256',
    keyid: OP_KID
  });
}

test.beforeEach(configure);

test('valida firma, issuer, audience, nonce, acr e at_hash', () => {
  const accessToken = 'access-token-value';
  const nonce = 'n'.repeat(64);
  const idToken = makeIdToken({ accessToken, nonce });

  const result = validateCieIdToken({
    idToken,
    accessToken,
    expectedNonce: nonce
  });

  assert.equal(result.sub, 'pairwise-subject');
  assert.equal(result.issuer, 'https://cie-op.example');
});

test('rifiuta nonce diverso', () => {
  const accessToken = 'access-token-value';
  const idToken = makeIdToken({
    accessToken,
    nonce: 'a'.repeat(64)
  });

  assert.throws(
    () => validateCieIdToken({
      idToken,
      accessToken,
      expectedNonce: 'b'.repeat(64)
    }),
    /Nonce/
  );
});

test('rifiuta at_hash non coerente con access token', () => {
  const idToken = makeIdToken({
    accessToken: 'access-token-corretto',
    nonce: 'a'.repeat(64)
  });

  assert.throws(
    () => validateCieIdToken({
      idToken,
      accessToken: 'access-token-diverso',
      expectedNonce: 'a'.repeat(64)
    }),
    /at_hash/
  );
});

test('rifiuta issuer errato', () => {
  const accessToken = 'access-token-value';
  const nonce = 'a'.repeat(64);
  const idToken = makeIdToken({
    accessToken,
    nonce,
    overrides: { iss: 'https://evil.example' }
  });

  assert.throws(
    () => validateCieIdToken({ idToken, accessToken, expectedNonce: nonce }),
    /issuer/i
  );
});

test('accetta ACR superiore e rifiuta ACR inferiore', () => {
  assert.equal(
    verifyAcr('https://www.spid.gov.it/SpidL3', 'https://www.spid.gov.it/SpidL2'),
    true
  );
  assert.equal(
    verifyAcr('https://www.spid.gov.it/SpidL1', 'https://www.spid.gov.it/SpidL2'),
    false
  );
});
