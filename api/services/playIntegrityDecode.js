'use strict';

const { isActivationAuthorized, analyzeDecodedVerdict, PACKAGE_NAME } = require('./playIntegrityPolicy');
const { localDecodeBudget } = require('./playIntegrityBudget');

const PLAY_INTEGRITY_SCOPE = 'https://www.googleapis.com/auth/playintegrity';
const DECODER_URL = 'https://playintegrity.googleapis.com/v1/' + PACKAGE_NAME + ':decodeIntegrityToken';

// This module does not create an API route or run a network call at import time.
// Calls remain blocked by the cost / consent gate unless a later release explicitly enables all flags.
async function defaultGoogleAccessToken() {
  const { GoogleAuth } = require('google-auth-library');
  const auth = new GoogleAuth({ scopes: [PLAY_INTEGRITY_SCOPE] });
  const client = await auth.getClient();
  const answer = await client.getAccessToken();
  if (!answer || typeof answer.token !== 'string' || !answer.token) {
    throw new Error('Missing Google access token');
  }
  return answer.token;
}

function validToken(token) {
  return typeof token === 'string' && token.length >= 32 && token.length <= 65536
    && /^[A-Za-z0-9._\-+/=:]+$/.test(token);
}

// Returns only a bounded, non-sensitive classification. Never returns the raw
// integrity token, credentials, or the full decoded Google response.
async function decodePlayIntegrity({
  integrityToken, action, payload, env = process.env, now = Date.now(),
  getAccessToken = defaultGoogleAccessToken, fetchImpl = globalThis.fetch,
  budget = localDecodeBudget, telemetry = null
} = {}) {
  const finish = (result) => {
    // Optional, in-memory and coarse only. Never send full token or payload.
    try { telemetry?.record(result, now); } catch { /* No telemetry side effects */ }
    return result;
  };
  if (!isActivationAuthorized(env)) return finish({ status: 'disabled' });
  if (!validToken(integrityToken)) return finish({ status: 'unavailable', reason: 'invalid_token' });
  // Reserve before touching Google credentials or API. The limit is PER PROCESS,
  // not a global Cloud quota; a shared limiter is still required at rollout.
  if (!budget?.reserve(now)) return finish({ status: 'unavailable', reason: 'local_quota_exhausted' });

  try {
    const accessToken = await getAccessToken();
    if (typeof accessToken !== 'string' || !accessToken) {
      return finish({ status: 'unavailable', reason: 'google_auth_error' });
    }
    const response = await fetchImpl(DECODER_URL, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer ' + accessToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ integrity_token: integrityToken }),
      signal: AbortSignal.timeout(5000)
    });

    if (!response || !response.ok) {
      // All remote errors (including quota 429) fail open for attestation only.
      // Existing DEMOS auth, authorization and rate limits must remain in force.
      return finish({ status: 'unavailable', reason: 'google_unavailable' });
    }
    const decodedResponse = await response.json();
    return finish(analyzeDecodedVerdict(decodedResponse, { action, payload, now }));
  } catch {
    // Never log token, payload, credentials or exception details.
    return { status: 'unavailable', reason: 'google_unavailable' };
  }
}

module.exports = { decodePlayIntegrity, validToken, DECODER_URL, PLAY_INTEGRITY_SCOPE };
