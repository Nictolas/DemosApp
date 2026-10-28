const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { FISCAL_NUMBER_CLAIM, getCieOidcConfig } = require('./cieOidcAuthorizationService');
const { getTrustedJwks } = require('./cieOidcIdTokenService');
const { sexFromVerifiedCieGender } = require('../utils/cieSex');

const SUPPORTED_JWE_ALGS = new Set(['RSA-OAEP', 'RSA-OAEP-256']);
const CBC_ENC = {
  'A128CBC-HS256': { cekLength: 32, macLength: 16, encLength: 16, hash: 'sha256', cipher: 'aes-128-cbc', tagLength: 16 },
  'A192CBC-HS384': { cekLength: 48, macLength: 24, encLength: 24, hash: 'sha384', cipher: 'aes-192-cbc', tagLength: 24 },
  'A256CBC-HS512': { cekLength: 64, macLength: 32, encLength: 32, hash: 'sha512', cipher: 'aes-256-cbc', tagLength: 32 }
};

function decodeBase64Secret(name) {
  const value = process.env[name];
  if (!value) return null;

  try {
    return Buffer.from(value, 'base64').toString('utf8');
  } catch (_error) {
    return null;
  }
}

function requireHttpsUrl(name, value) {
  if (!value) throw new Error(`${name} non configurato`);
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error(`${name} deve usare HTTPS`);
  return value;
}

function getCieUserInfoConfig() {
  const oidc = getCieOidcConfig();
  const userInfoEndpoint = requireHttpsUrl(
    'CIE_OP_USERINFO_ENDPOINT',
    process.env.CIE_OP_USERINFO_ENDPOINT
  );
  const signingAlg = process.env.CIE_USERINFO_SIGNING_ALG;
  const encryptionAlg = process.env.CIE_USERINFO_ENCRYPTION_ALG;
  const encryptionEnc = process.env.CIE_USERINFO_ENCRYPTION_ENC;
  const decryptionKid = process.env.CIE_RP_DECRYPTION_KID;
  const decryptionPrivateKey = decodeBase64Secret('CIE_RP_DECRYPTION_PRIVATE_KEY_B64');

  if (!signingAlg) throw new Error('CIE_USERINFO_SIGNING_ALG non configurato');
  if (!SUPPORTED_JWE_ALGS.has(encryptionAlg)) {
    throw new Error('CIE_USERINFO_ENCRYPTION_ALG non supportato');
  }
  if (!CBC_ENC[encryptionEnc]) {
    throw new Error('CIE_USERINFO_ENCRYPTION_ENC non supportato');
  }
  if (!decryptionKid) throw new Error('CIE_RP_DECRYPTION_KID non configurato');
  if (!decryptionPrivateKey || !decryptionPrivateKey.includes('PRIVATE KEY')) {
    throw new Error('CIE_RP_DECRYPTION_PRIVATE_KEY_B64 non configurata o non valida');
  }

  return {
    ...oidc,
    userInfoEndpoint,
    signingAlg,
    encryptionAlg,
    encryptionEnc,
    decryptionKid,
    decryptionPrivateKey
  };
}

function decodeBase64UrlPart(value, label) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]+$/.test(value)) {
    throw new Error(`${label} UserInfo CIE non valido`);
  }

  return Buffer.from(value, 'base64url');
}

function decodeProtectedHeader(encoded, label) {
  try {
    return JSON.parse(decodeBase64UrlPart(encoded, label).toString('utf8'));
  } catch (_error) {
    throw new Error(`${label} UserInfo CIE non valido`);
  }
}

function decryptCbcHmac({ protectedPart, iv, ciphertext, tag, cek, enc }) {
  const params = CBC_ENC[enc];
  if (!params || cek.length !== params.cekLength || iv.length !== 16 || tag.length !== params.tagLength) {
    throw new Error('Parametri cifratura UserInfo CIE non validi');
  }

  const macKey = cek.subarray(0, params.macLength);
  const encKey = cek.subarray(params.macLength, params.macLength + params.encLength);
  const aad = Buffer.from(protectedPart, 'ascii');
  const al = Buffer.alloc(8);
  al.writeBigUInt64BE(BigInt(aad.length * 8));

  const expectedTag = crypto
    .createHmac(params.hash, macKey)
    .update(Buffer.concat([aad, iv, ciphertext, al]))
    .digest()
    .subarray(0, params.tagLength);

  if (expectedTag.length !== tag.length || !crypto.timingSafeEqual(expectedTag, tag)) {
    throw new Error('Tag cifratura UserInfo CIE non valido');
  }

  const decipher = crypto.createDecipheriv(params.cipher, encKey, iv);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

function decryptCieUserInfoJwe(compactJwe, config = getCieUserInfoConfig()) {
  if (typeof compactJwe !== 'string') throw new Error('UserInfo CIE non valida');

  const parts = compactJwe.trim().split('.');
  if (parts.length !== 5 || parts.some(part => !part)) {
    throw new Error('UserInfo CIE non e un JWE compatto');
  }

  const [protectedPart, encryptedKeyPart, ivPart, ciphertextPart, tagPart] = parts;
  const header = decodeProtectedHeader(protectedPart, 'Header JWE');

  if (
    header.alg !== config.encryptionAlg ||
    !SUPPORTED_JWE_ALGS.has(header.alg) ||
    header.enc !== config.encryptionEnc ||
    !CBC_ENC[header.enc] ||
    header.kid !== config.decryptionKid ||
    header.cty !== 'JWT'
  ) {
    throw new Error('Header JWE UserInfo CIE non autorizzato');
  }

  try {
    const encryptedKey = decodeBase64UrlPart(encryptedKeyPart, 'Chiave JWE');
    const iv = decodeBase64UrlPart(ivPart, 'IV JWE');
    const ciphertext = decodeBase64UrlPart(ciphertextPart, 'Ciphertext JWE');
    const tag = decodeBase64UrlPart(tagPart, 'Tag JWE');

    const cek = crypto.privateDecrypt(
      {
        key: config.decryptionPrivateKey,
        padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: header.alg === 'RSA-OAEP-256' ? 'sha256' : 'sha1'
      },
      encryptedKey
    );

    return decryptCbcHmac({
      protectedPart,
      iv,
      ciphertext,
      tag,
      cek,
      enc: header.enc
    });
  } catch (error) {
    if (error?.message?.includes('UserInfo CIE')) throw error;
    throw new Error('Decifratura UserInfo CIE non riuscita');
  }
}

function resolveUserInfoVerificationKey(jws, config, jwks = getTrustedJwks()) {
  const decoded = jwt.decode(jws, { complete: true });
  const header = decoded?.header;

  if (
    !header?.kid ||
    header.alg !== config.signingAlg ||
    header.cty !== 'JWT'
  ) {
    throw new Error('Header JWS UserInfo CIE non autorizzato');
  }

  const jwk = jwks.keys.find(key =>
    key.kid === header.kid &&
    (!key.use || key.use === 'sig') &&
    (!key.alg || key.alg === config.signingAlg)
  );
  if (!jwk) throw new Error('Chiave firma UserInfo CIE non trovata o non autorizzata');

  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
}

function validateCieUserInfoJws(
  { jws, expectedSub },
  config = getCieUserInfoConfig(),
  jwks
) {
  if (typeof jws !== 'string' || !jws || typeof expectedSub !== 'string' || !expectedSub) {
    throw new Error('Dati UserInfo CIE incompleti');
  }

  const publicKey = resolveUserInfoVerificationKey(jws, config, jwks);
  const claims = jwt.verify(jws, publicKey, {
    algorithms: [config.signingAlg],
    issuer: config.issuer,
    audience: config.clientId,
    clockTolerance: 5
  });

  if (
    typeof claims.iat !== 'number' ||
    typeof claims.nbf !== 'number' ||
    typeof claims.exp !== 'number' ||
    claims.nbf !== claims.iat
  ) {
    throw new Error('Claim temporali UserInfo CIE non validi');
  }
  if (claims.sub !== expectedSub) {
    throw new Error('sub UserInfo CIE non coincide con ID Token');
  }

  const fiscalNumber = claims[FISCAL_NUMBER_CLAIM];
  if (typeof fiscalNumber !== 'string' || !fiscalNumber.trim()) {
    throw new Error('fiscal_number UserInfo CIE mancante');
  }

  // Il claim viene letto esclusivamente dopo la verifica crittografica JWS.
  // Se non richiesto/autorizzato, non entra neppure nel payload interno.
  const sesso = process.env.CIE_SEX_COLLECTION_ENABLED === 'true'
    ? sexFromVerifiedCieGender(claims.gender)
    : null;
  return {
    fiscalNumber: fiscalNumber.trim(),
    ...(sesso ? { sesso } : {})
  };
}

async function fetchAndValidateCieUserInfo(
  { accessToken, expectedSub },
  httpClient = axios
) {
  if (typeof accessToken !== 'string' || !accessToken) {
    throw new Error('Access Token CIE mancante');
  }

  const config = getCieUserInfoConfig();
  const response = await httpClient.get(config.userInfoEndpoint, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/jwt, application/jose'
    },
    responseType: 'text',
    transformResponse: [data => data],
    timeout: 10000
  });

  const contentType = String(response?.headers?.['content-type'] || '').toLowerCase();
  if (!/^application\/(jwt|jose)(?:\s*;|$)/.test(contentType)) {
    throw new Error('Content-Type UserInfo CIE non valido');
  }

  const jws = decryptCieUserInfoJwe(response?.data, config);
  return validateCieUserInfoJws({ jws, expectedSub }, config);
}

module.exports = {
  CBC_ENC,
  getCieUserInfoConfig,
  decryptCieUserInfoJwe,
  validateCieUserInfoJws,
  fetchAndValidateCieUserInfo
};
