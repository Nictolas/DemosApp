const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const {
  FISCAL_NUMBER_CLAIM,
  createAuthorizationRequest
} = require('../services/cieOidcAuthorizationService');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048
});

function configure() {
  process.env.CIE_OIDC_ENABLED = 'true';
  process.env.CIE_RP_ENTITY_ID = 'https://demos.example/rp';
  process.env.CIE_OP_ISSUER = 'https://cie-op.example';
  process.env.CIE_OP_AUTHORIZATION_ENDPOINT = 'https://cie-op.example/authorize';
  process.env.CIE_REDIRECT_URI = 'https://demos.example/api/auth/cie/callback';
  process.env.CIE_RP_SIGNING_KID = 'test-kid';
  process.env.CIE_RP_SIGNING_PRIVATE_KEY_B64 = Buffer
    .from(privateKey.export({ type: 'pkcs8', format: 'pem' }))
    .toString('base64');
  process.env.CIE_ACR_VALUES = 'https://www.spid.gov.it/SpidL2';
}

test.beforeEach(configure);

test('costruisce authorization request CIE firmata RS256 con PKCE', () => {
  const { authorizationUrl, transaction } = createAuthorizationRequest(1700000000);
  const url = new URL(authorizationUrl);

  assert.equal(url.origin + url.pathname, 'https://cie-op.example/authorize');
  assert.equal(url.searchParams.get('client_id'), 'https://demos.example/rp');
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('scope'), 'openid');
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(url.searchParams.get('code_challenge'), transaction.codeChallenge ?? url.searchParams.get('code_challenge'));

  const request = url.searchParams.get('request');
  const decoded = jwt.verify(request, publicKey, {
    algorithms: ['RS256'],
    audience: 'https://cie-op.example',
    issuer: 'https://demos.example/rp'
  });

  assert.equal(decoded.client_id, 'https://demos.example/rp');
  assert.equal(decoded.redirect_uri, 'https://demos.example/api/auth/cie/callback');
  assert.equal(decoded.state, transaction.state);
  assert.equal(decoded.nonce, transaction.nonce);
  assert.equal(decoded.code_challenge_method, 'S256');
  assert.equal(decoded.iat, 1700000000);
  assert.equal(decoded.exp, 1700000300);
  assert.deepEqual(decoded.claims, {
    userinfo: { [FISCAL_NUMBER_CLAIM]: null }
  });
});

test('state e nonce del flusso reale sono alfanumerici e >= 32 caratteri', () => {
  const { transaction } = createAuthorizationRequest();

  assert.match(transaction.state, /^[A-Za-z0-9]{32,}$/);
  assert.match(transaction.nonce, /^[A-Za-z0-9]{32,}$/);
});

test('OIDC CIE reale resta disabilitato senza flag esplicito', () => {
  process.env.CIE_OIDC_ENABLED = 'false';

  assert.throws(
    () => createAuthorizationRequest(),
    error => error.code === 'CIE_OIDC_DISABLED'
  );
});
