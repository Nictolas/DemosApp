const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const axios = require('axios');
const { getCieOidcConfig } = require('./cieOidcAuthorizationService');

const CLIENT_ASSERTION_TYPE = 'urn:ietf:params:oauth:client-assertion-type:jwt-bearer';

function createClientAssertion(config, nowSeconds = Math.floor(Date.now() / 1000)) {
  return jwt.sign(
    {
      iss: config.clientId,
      sub: config.clientId,
      aud: config.tokenEndpoint,
      iat: nowSeconds,
      exp: nowSeconds + 300,
      jti: crypto.randomUUID()
    },
    config.privateKey,
    {
      algorithm: 'RS256',
      keyid: config.signingKid
    }
  );
}

async function exchangeAuthorizationCode(
  { code, codeVerifier },
  httpClient = axios,
  nowSeconds = Math.floor(Date.now() / 1000)
) {
  if (typeof code !== 'string' || !code) throw new Error('Authorization code mancante');
  if (typeof codeVerifier !== 'string' || !codeVerifier) throw new Error('PKCE code_verifier mancante');

  const config = getCieOidcConfig();
  if (!config.tokenEndpoint) throw new Error('CIE_OP_TOKEN_ENDPOINT non configurato');

  const clientAssertion = createClientAssertion(config, nowSeconds);
  const body = new URLSearchParams({
    client_id: config.clientId,
    client_assertion: clientAssertion,
    client_assertion_type: CLIENT_ASSERTION_TYPE,
    code,
    code_verifier: codeVerifier,
    grant_type: 'authorization_code'
  });

  const response = await httpClient.post(config.tokenEndpoint, body.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    timeout: 10000
  });

  const tokens = response?.data || {};
  if (typeof tokens.id_token !== 'string' || typeof tokens.access_token !== 'string') {
    throw new Error('Risposta Token Endpoint CIE incompleta');
  }

  return {
    idToken: tokens.id_token,
    accessToken: tokens.access_token,
    tokenType: tokens.token_type || null,
    expiresIn: tokens.expires_in || null
  };
}

module.exports = {
  CLIENT_ASSERTION_TYPE,
  createClientAssertion,
  exchangeAuthorizationCode
};
