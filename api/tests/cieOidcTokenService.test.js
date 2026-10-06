const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const {
  CLIENT_ASSERTION_TYPE,
  createClientAssertion,
  exchangeAuthorizationCode
} = require('../services/cieOidcTokenService');

const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048
});

function configure() {
  process.env.CIE_OIDC_ENABLED = 'true';
  process.env.CIE_RP_ENTITY_ID = 'https://demos.example/rp';
  process.env.CIE_OP_ISSUER = 'https://cie-op.example';
  process.env.CIE_OP_AUTHORIZATION_ENDPOINT = 'https://cie-op.example/authorize';
  process.env.CIE_OP_TOKEN_ENDPOINT = 'https://cie-op.example/token';
  process.env.CIE_REDIRECT_URI = 'https://demos.example/api/auth/cie/callback';
  process.env.CIE_RP_SIGNING_KID = 'test-kid';
  process.env.CIE_RP_SIGNING_PRIVATE_KEY_B64 = Buffer
    .from(privateKey.export({ type: 'pkcs8', format: 'pem' }))
    .toString('base64');
  process.env.CIE_ACR_VALUES = 'https://www.spid.gov.it/SpidL2';
}

test.beforeEach(configure);

test('client assertion private_key_jwt contiene i claim richiesti', () => {
  const config = {
    clientId: 'https://demos.example/rp',
    tokenEndpoint: 'https://cie-op.example/token',
    signingKid: 'test-kid',
    privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' })
  };

  const assertion = createClientAssertion(config, 1700000000);
  const decoded = jwt.verify(assertion, publicKey, {
    algorithms: ['RS256'],
    audience: 'https://cie-op.example/token',
    issuer: 'https://demos.example/rp',
    clockTimestamp: 1700000000
  });

  assert.equal(decoded.sub, 'https://demos.example/rp');
  assert.equal(decoded.iat, 1700000000);
  assert.equal(decoded.exp, 1700000300);
  assert.match(decoded.jti, /^[0-9a-f-]{36}$/i);
});

test('token exchange invia private_key_jwt, code e PKCE verifier', async () => {
  let captured;
  const httpClient = {
    async post(url, body, options) {
      captured = { url, body, options };
      return {
        data: {
          id_token: 'signed-id-token',
          access_token: 'signed-access-token',
          token_type: 'Bearer',
          expires_in: 300
        }
      };
    }
  };

  const result = await exchangeAuthorizationCode({
    code: 'authorization-code',
    codeVerifier: 'pkce-verifier'
  }, httpClient, 1700000000);

  const params = new URLSearchParams(captured.body);
  assert.equal(captured.url, 'https://cie-op.example/token');
  assert.equal(params.get('client_id'), 'https://demos.example/rp');
  assert.equal(params.get('client_assertion_type'), CLIENT_ASSERTION_TYPE);
  assert.equal(params.get('code'), 'authorization-code');
  assert.equal(params.get('code_verifier'), 'pkce-verifier');
  assert.equal(params.get('grant_type'), 'authorization_code');
  assert.ok(params.get('client_assertion'));
  assert.equal(result.idToken, 'signed-id-token');
  assert.equal(result.accessToken, 'signed-access-token');
});

test('rifiuta una risposta token incompleta', async () => {
  const httpClient = {
    async post() {
      return { data: { access_token: 'only-access-token' } };
    }
  };

  await assert.rejects(
    exchangeAuthorizationCode({
      code: 'authorization-code',
      codeVerifier: 'pkce-verifier'
    }, httpClient),
    /incompleta/
  );
});
