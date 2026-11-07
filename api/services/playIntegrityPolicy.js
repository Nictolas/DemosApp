'use strict';
const crypto = require('node:crypto');

const PACKAGE_NAME = 'community.demos';
// The existing Play Console-linked DEMOS Cloud project, not a new resource.
const EXPECTED_CLOUD_PROJECT_NUMBER = '848085963511';
const TOKEN_MAX_AGE_MS = 120_000;
const FUTURE_SKEW_MS = 30_000;

// Explicitly disabled without owner-approved zero-cost operation and an existing project.
function isActivationAuthorized(env = process.env) {
  return env.PLAY_INTEGRITY_ENABLED === 'true'
    && env.PLAY_INTEGRITY_ZERO_COST_CONFIRMED === 'true'
    && env.PLAY_INTEGRITY_CLOUD_PROJECT_NUMBER === EXPECTED_CLOUD_PROJECT_NUMBER;
}

function stableJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean'
      || (typeof value === 'number' && Number.isFinite(value))) return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableJson).join(',') + ']';
  if (value && typeof value === 'object' && Object.getPrototypeOf(value) === Object.prototype) {
    return '{' + Object.keys(value).sort().map(key => {
      if (value[key] === undefined) throw new TypeError('Undefined request field');
      return JSON.stringify(key) + ':' + stableJson(value[key]);
    }).join(',') + '}';
  }
  throw new TypeError('Unsupported request field');
}

function createRequestHash(action, payload) {
  if (typeof action !== 'string' || !/^[a-z0-9_.:-]{1,64}$/.test(action)) {
    throw new TypeError('Invalid action');
  }
  return crypto.createHash('sha256')
    .update('DEMOS-PLAY-INTEGRITY-v1\n' + stableJson({ action, payload }), 'utf8')
    .digest('base64url');
}

function sameHash(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (!/^[A-Za-z0-9_-]{43}$/.test(a) || !/^[A-Za-z0-9_-]{43}$/.test(b)) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

// Pure analysis of a verdict obtained AFTER server-side Google decoding.
// Do not pass client-supplied JSON or use this function as a token verifier.
function analyzeDecodedVerdict(decodedResponse, { action, payload, now = Date.now() } = {}) {
  const verdict = decodedResponse && decodedResponse.tokenPayloadExternal;
  if (!verdict || typeof verdict !== 'object') return { status: 'unavailable', reason: 'no_decoded_verdict' };

  const request = verdict.requestDetails || {};
  if (request.requestPackageName !== PACKAGE_NAME) {
    return { status: 'untrusted', reason: 'package_mismatch' };
  }
  const timestamp = Number(request.timestampMillis);
  if (!Number.isSafeInteger(timestamp) || timestamp > now + FUTURE_SKEW_MS
      || timestamp < now - TOKEN_MAX_AGE_MS) {
    return { status: 'untrusted', reason: 'invalid_timestamp' };
  }

  let expected;
  try {
    expected = createRequestHash(action, payload);
  } catch {
    return { status: 'untrusted', reason: 'invalid_request' };
  }
  if (!sameHash(request.requestHash, expected)) {
    return { status: 'untrusted', reason: 'hash_mismatch' };
  }

  // The decoded app package is separate from requestDetails and may be present
  // in Google's appIntegrity field. Reject contradictions in an attested token.
  const binaryPackage = verdict.appIntegrity?.packageName;
  if (typeof binaryPackage === 'string' && binaryPackage !== PACKAGE_NAME) {
    return { status: 'untrusted', reason: 'app_binary_package_mismatch' };
  }

  const appRecognized = verdict.appIntegrity?.appRecognitionVerdict === 'PLAY_RECOGNIZED';
  const recognizedLabels = verdict.deviceIntegrity?.deviceRecognitionVerdict;
  const deviceRecognized = Array.isArray(recognizedLabels) && recognizedLabels.some(
    label => label === 'MEETS_DEVICE_INTEGRITY' || label === 'MEETS_STRONG_INTEGRITY'
  );
  const rawLicensing = verdict.accountDetails?.appLicensingVerdict;
  const licensingVerdict = ['LICENSED', 'UNLICENSED', 'UNEVALUATED'].includes(rawLicensing)
    ? rawLicensing : 'NOT_AVAILABLE';
  // Observational signals only. Do not infer the person's identity or reject access.
  return {
    licensingVerdict,
    enforcement: 'none',
    status: appRecognized && deviceRecognized ? 'verified' : 'untrusted',
    reason: appRecognized && deviceRecognized ? 'recognized' : 'insufficient_integrity',
    appRecognized, deviceRecognized
  };
}

module.exports = { PACKAGE_NAME, EXPECTED_CLOUD_PROJECT_NUMBER, isActivationAuthorized, stableJson, createRequestHash, analyzeDecodedVerdict };
