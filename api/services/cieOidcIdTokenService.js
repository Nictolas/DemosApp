const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { getCieOidcConfig } = require('./cieOidcAuthorizationService');
const { verifyNonce } = require('./cieOidcTransactionService');

function getTrustedJwks() {
  const encoded = process.env.CIE_OP_JWKS_B64;
  if (!encoded) throw new Error('CIE_OP_JWKS_B64 non configurato');

  let jwks;
  try {
    jwks = JSON.parse(Buffer.from(encoded, 'base64').toString('utf8'));
  } catch (_error) {
    throw new Error('CIE_OP_JWKS_B64 non valido');
  }

  if (!jwks || !Array.isArray(jwks.keys) || jwks.keys.length === 0) {
    throw new Error('JWKS CIE vuoto o non valido');
  }

  return jwks;
}

function resolveVerificationKey(idToken, jwks = getTrustedJwks()) {
  const decoded = jwt.decode(idToken, { complete: true });
  const kid = decoded?.header?.kid;
  const alg = decoded?.header?.alg;

  if (!kid || !alg) throw new Error('Header ID Token CIE incompleto');

  const expectedAlg = process.env.CIE_ID_TOKEN_SIGNING_ALG;
  if (!expectedAlg) throw new Error('CIE_ID_TOKEN_SIGNING_ALG non configurato');
  if (alg !== expectedAlg) throw new Error('Algoritmo ID Token CIE inatteso');

  const jwk = jwks.keys.find(key =>
    key.kid === kid &&
    (!key.use || key.use === 'sig') &&
    (!key.alg || key.alg === expectedAlg)
  );
  if (!jwk) throw new Error('Chiave ID Token CIE non trovata o non autorizzata');

  return {
    alg,
    publicKey: crypto.createPublicKey({ key: jwk, format: 'jwk' })
  };
}

function acrLevel(value) {
  const match = typeof value === 'string' ? value.match(/L([1-3])$/) : null;
  return match ? Number(match[1]) : null;
}

function verifyAcr(actual, requested) {
  const actualLevel = acrLevel(actual);
  const requestedLevel = acrLevel(requested);

  if (actualLevel != null && requestedLevel != null) {
    return actualLevel >= requestedLevel;
  }

  return actual === requested;
}

function hashForJwtAlg(alg) {
  if (alg.endsWith('256')) return 'sha256';
  if (alg.endsWith('384')) return 'sha384';
  if (alg.endsWith('512')) return 'sha512';
  throw new Error('Algoritmo ID Token non supportato per at_hash');
}

function computeAtHash(accessToken, alg) {
  const digest = crypto
    .createHash(hashForJwtAlg(alg))
    .update(accessToken, 'ascii')
    .digest();

  return digest.subarray(0, digest.length / 2).toString('base64url');
}

function validateCieIdToken(
  { idToken, accessToken, expectedNonce },
  jwks
) {
  if (!idToken || !accessToken || !expectedNonce) {
    throw new Error('Dati per validazione ID Token CIE incompleti');
  }

  const config = getCieOidcConfig();
  const { alg, publicKey } = resolveVerificationKey(idToken, jwks);

  const claims = jwt.verify(idToken, publicKey, {
    algorithms: [alg],
    issuer: config.issuer,
    audience: config.clientId,
    clockTolerance: 5
  });

  if (!verifyNonce(expectedNonce, claims.nonce)) {
    throw new Error('Nonce ID Token CIE non valido');
  }

  if (!verifyAcr(claims.acr, config.acrValues)) {
    throw new Error('Livello ACR CIE insufficiente');
  }

  if (typeof claims.iat !== 'number' || typeof claims.nbf !== 'number' || claims.nbf !== claims.iat) {
    throw new Error('Claim temporali ID Token CIE non validi');
  }

  if (typeof claims.jti !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(claims.jti)) {
    throw new Error('jti ID Token CIE non valido');
  }

  const expectedAtHash = computeAtHash(accessToken, alg);
  const actualAtHash = typeof claims.at_hash === 'string'
    ? Buffer.from(claims.at_hash)
    : null;
  const expectedAtHashBuffer = Buffer.from(expectedAtHash);

  if (
    !actualAtHash ||
    actualAtHash.length !== expectedAtHashBuffer.length ||
    !crypto.timingSafeEqual(actualAtHash, expectedAtHashBuffer)
  ) {
    throw new Error('at_hash ID Token CIE non valido');
  }

  if (typeof claims.sub !== 'string' || !claims.sub) {
    throw new Error('sub ID Token CIE mancante');
  }

  return {
    sub: claims.sub,
    issuer: claims.iss,
    acr: claims.acr,
    jti: claims.jti
  };
}

module.exports = {
  getTrustedJwks,
  resolveVerificationKey,
  verifyAcr,
  computeAtHash,
  validateCieIdToken
};
