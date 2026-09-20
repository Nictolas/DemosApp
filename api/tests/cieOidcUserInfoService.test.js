const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const {
  CBC_ENC,
  decryptCieUserInfoJwe,
  validateCieUserInfoJws,
  fetchAndValidateCieUserInfo
} = require('../services/cieOidcUserInfoService');
const { FISCAL_NUMBER_CLAIM } = require('../services/cieOidcAuthorizationService');

const { privateKey: opPrivateKey, publicKey: opPublicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048
});
const { privateKey: rpDecryptPrivateKey, publicKey: rpDecryptPublicKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048
});
const { privateKey: rpSigningPrivateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048
});

const OP_KID = 'op-userinfo-signing';
const RP_DECRYPT_KID = 'rp-userinfo-encryption';

function configure() {
  process.env.CIE_OIDC_ENABLED = 'true';
  process.env.CIE_RP_ENTITY_ID = 'https://demos.example/rp';
  process.env.CIE_OP_ISSUER = 'https://cie-op.example';
  process.env.CIE_OP_AUTHORIZATION_ENDPOINT = 'https://cie-op.example/authorize';
  process.env.CIE_OP_TOKEN_ENDPOINT = 'https://cie-op.example/token';
  process.env.CIE_OP_USERINFO_ENDPOINT = 'https://cie-op.example/userinfo';
  process.env.CIE_REDIRECT_URI = 'https://demos.example/api/auth/cie/callback';
  process.env.CIE_RP_SIGNING_KID = 'rp-signing';
  process.env.CIE_RP_SIGNING_PRIVATE_KEY_B64 = Buffer
    .from(rpSigningPrivateKey.export({ type: 'pkcs8', format: 'pem' }))
    .toString('base64');
  process.env.CIE_ACR_VALUES = 'https://www.spid.gov.it/SpidL2';

  process.env.CIE_USERINFO_SIGNING_ALG = 'RS256';
  process.env.CIE_USERINFO_ENCRYPTION_ALG = 'RSA-OAEP';
  process.env.CIE_USERINFO_ENCRYPTION_ENC = 'A256CBC-HS512';
  process.env.CIE_RP_DECRYPTION_KID = RP_DECRYPT_KID;
  process.env.CIE_RP_DECRYPTION_PRIVATE_KEY_B64 = Buffer
    .from(rpDecryptPrivateKey.export({ type: 'pkcs8', format: 'pem' }))
    .toString('base64');

  const jwk = opPublicKey.export({ format: 'jwk' });
  jwk.kid = OP_KID;
  jwk.use = 'sig';
  jwk.alg = 'RS256';
  process.env.CIE_OP_JWKS_B64 = Buffer.from(JSON.stringify({ keys: [jwk] })).toString('base64');
}

function makeSignedUserInfo({ sub = 'pairwise-subject', fiscalNumber = 'RSSMRA80A01H501U' } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: 'https://cie-op.example',
      aud: 'https://demos.example/rp',
      sub,
      iat: now,
      nbf: now,
      exp: now + 300,
      [FISCAL_NUMBER_CLAIM]: fiscalNumber,
      ignored_claim: 'non deve uscire'
    },
    opPrivateKey,
    {
      algorithm: 'RS256',
      keyid: OP_KID,
      header: { cty: 'JWT' }
    }
  );
}

function encryptCbcHmac(plaintext, protectedPart, cek, iv, enc = 'A256CBC-HS512') {
  const params = CBC_ENC[enc];
  const macKey = cek.subarray(0, params.macLength);
  const encKey = cek.subarray(params.macLength, params.macLength + params.encLength);
  const cipher = crypto.createCipheriv(params.cipher, encKey, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const aad = Buffer.from(protectedPart, 'ascii');
  const al = Buffer.alloc(8);
  al.writeBigUInt64BE(BigInt(aad.length * 8));
  const tag = crypto
    .createHmac(params.hash, macKey)
    .update(Buffer.concat([aad, iv, ciphertext, al]))
    .digest()
    .subarray(0, params.tagLength);

  return { ciphertext, tag };
}

function makeEncryptedUserInfo(jws) {
  const header = {
    alg: 'RSA-OAEP',
    enc: 'A256CBC-HS512',
    kid: RP_DECRYPT_KID,
    cty: 'JWT'
  };
  const protectedPart = Buffer.from(JSON.stringify(header)).toString('base64url');
  const cek = crypto.randomBytes(CBC_ENC['A256CBC-HS512'].cekLength);
  const iv = crypto.randomBytes(16);
  const encryptedKey = crypto.publicEncrypt(
    {
      key: rpDecryptPublicKey,
      padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: 'sha1'
    },
    cek
  );
  const { ciphertext, tag } = encryptCbcHmac(jws, protectedPart, cek, iv);

  return [
    protectedPart,
    encryptedKey.toString('base64url'),
    iv.toString('base64url'),
    ciphertext.toString('base64url'),
    tag.toString('base64url')
  ].join('.');
}

test.beforeEach(configure);

test('decifra JWE, verifica JWS e restituisce solo fiscalNumber', () => {
  const jws = makeSignedUserInfo();
  const compactJwe = makeEncryptedUserInfo(jws);
  const decrypted = decryptCieUserInfoJwe(compactJwe);
  assert.equal(decrypted, jws);

  const result = validateCieUserInfoJws({
    jws: decrypted,
    expectedSub: 'pairwise-subject'
  });

  assert.deepEqual(result, { fiscalNumber: 'RSSMRA80A01H501U' });
  assert.equal(result.ignored_claim, undefined);
});

test('rifiuta UserInfo con sub diverso dall ID Token', () => {
  const jws = makeSignedUserInfo({ sub: 'altro-subject' });

  assert.throws(
    () => validateCieUserInfoJws({ jws, expectedSub: 'pairwise-subject' }),
    /sub UserInfo/
  );
});

test('recupera UserInfo con Bearer token e Content-Type application/jwt', async () => {
  const compactJwe = makeEncryptedUserInfo(makeSignedUserInfo());
  const calls = [];
  const httpClient = {
    async get(url, options) {
      calls.push({ url, options });
      return {
        data: compactJwe,
        headers: { 'content-type': 'application/jwt' }
      };
    }
  };

  const result = await fetchAndValidateCieUserInfo(
    { accessToken: 'access-token', expectedSub: 'pairwise-subject' },
    httpClient
  );

  assert.deepEqual(result, { fiscalNumber: 'RSSMRA80A01H501U' });
  assert.equal(calls[0].url, 'https://cie-op.example/userinfo');
  assert.equal(calls[0].options.headers.Authorization, 'Bearer access-token');
});

test('rifiuta UserInfo con Content-Type diverso da application/jwt', async () => {
  const httpClient = {
    async get() {
      return { data: 'not-used', headers: { 'content-type': 'application/json' } };
    }
  };

  await assert.rejects(
    fetchAndValidateCieUserInfo(
      { accessToken: 'access-token', expectedSub: 'pairwise-subject' },
      httpClient
    ),
    /Content-Type/
  );
});
