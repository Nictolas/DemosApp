const jwt = require('jsonwebtoken');
const { URL, URLSearchParams } = require('url');
const { createCieOidcTransaction } = require('./cieOidcTransactionService');
const { IDENTITY_ERROR_CODES } = require('../constants/identityVerification');

const FISCAL_NUMBER_CLAIM = 'https://attributes.eid.gov.it/fiscal_number';

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
  if (parsed.protocol !== 'https:') {
    throw new Error(`${name} deve usare HTTPS`);
  }

  return value;
}

function getCieOidcConfig() {
  if (process.env.CIE_OIDC_ENABLED !== 'true') {
    const error = new Error('OIDC CIE reale non abilitato');
    error.code = IDENTITY_ERROR_CODES.CIE_OIDC_DISABLED;
    throw error;
  }

  const clientId = requireHttpsUrl('CIE_RP_ENTITY_ID', process.env.CIE_RP_ENTITY_ID);
  const issuer = requireHttpsUrl('CIE_OP_ISSUER', process.env.CIE_OP_ISSUER);
  const authorizationEndpoint = requireHttpsUrl(
    'CIE_OP_AUTHORIZATION_ENDPOINT',
    process.env.CIE_OP_AUTHORIZATION_ENDPOINT
  );
  const redirectUri = requireHttpsUrl('CIE_REDIRECT_URI', process.env.CIE_REDIRECT_URI);
  const tokenEndpoint = requireHttpsUrl(
    'CIE_OP_TOKEN_ENDPOINT',
    process.env.CIE_OP_TOKEN_ENDPOINT
  );

  const signingKid = process.env.CIE_RP_SIGNING_KID;
  const privateKey = decodeBase64Secret('CIE_RP_SIGNING_PRIVATE_KEY_B64');
  const acrValues = process.env.CIE_ACR_VALUES;

  if (!signingKid) throw new Error('CIE_RP_SIGNING_KID non configurato');
  if (!privateKey || !privateKey.includes('PRIVATE KEY')) {
    throw new Error('CIE_RP_SIGNING_PRIVATE_KEY_B64 non configurata o non valida');
  }
  if (!acrValues) throw new Error('CIE_ACR_VALUES non configurato');

  return {
    clientId,
    issuer,
    authorizationEndpoint,
    tokenEndpoint,
    redirectUri,
    signingKid,
    privateKey,
    acrValues
  };
}

function createAuthorizationRequest(
  nowSeconds = Math.floor(Date.now() / 1000),
  purpose = 'identity'
) {
  if (!['identity', 'recognition'].includes(purpose)) {
    throw new Error('Finalita richiesta CIE non valida');
  }
  const config = getCieOidcConfig();
  const transaction = createCieOidcTransaction();
  const scope = 'openid';

  const claims = {
    userinfo: {
      [FISCAL_NUMBER_CLAIM]: null,
      ...(purpose === 'recognition'
        ? { given_name: { essential: true }, family_name: { essential: true } }
        : {})
    }
  };

  const payload = {
    client_id: config.clientId,
    response_type: 'code',
    scope,
    code_challenge: transaction.codeChallenge,
    code_challenge_method: transaction.codeChallengeMethod,
    nonce: transaction.nonce,
    prompt: 'consent',
    redirect_uri: config.redirectUri,
    acr_values: config.acrValues,
    claims,
    state: transaction.state,
    iat: nowSeconds,
    exp: nowSeconds + 300,
    iss: config.clientId,
    aud: config.issuer
  };

  const requestObject = jwt.sign(payload, config.privateKey, {
    algorithm: 'RS256',
    keyid: config.signingKid
  });

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope,
    code_challenge: transaction.codeChallenge,
    code_challenge_method: transaction.codeChallengeMethod,
    request: requestObject
  });

  return {
    authorizationUrl: `${config.authorizationEndpoint}?${params.toString()}`,
    transaction: {
      state: transaction.state,
      nonce: transaction.nonce,
      codeVerifier: transaction.codeVerifier,
      purpose,
      expiresAt: (nowSeconds + 300) * 1000
    }
  };
}

module.exports = {
  FISCAL_NUMBER_CLAIM,
  getCieOidcConfig,
  createAuthorizationRequest
};
