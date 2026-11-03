'use strict';

/**
 * Optional, observation-only Firebase App Check token verification for Render.
 *
 * This is NOT Play Integrity's decodeIntegrityToken and must never be mounted as
 * authentication/authorization middleware. Neither Google calls nor logging
 * occur unless two explicit environment gates and a real Android App ID exist,
 * AND a caller intentionally invokes observeAppCheckHeader().
 *
 * Do not persist or log the raw token, app ID, user ID or individual verdict.
 */
const EXPECTED_FIREBASE_PROJECT = 'demos-finale';
const HEADER_NAME = 'x-firebase-appcheck';
// Local CPU and certificate-fetch safety brake, NOT a global Play Integrity quota.
// Every Render process gets its own allowance; do not claim this prevents
// cross-process traffic or any account-wide bill.
const DEFAULT_MAX_VERIFICATIONS_PER_PROCESS_PER_DAY = 50;

function createAppCheckLocalBudget({ maxDaily = DEFAULT_MAX_VERIFICATIONS_PER_PROCESS_PER_DAY } = {}) {
  if (!Number.isSafeInteger(maxDaily) || maxDaily < 0 || maxDaily > 1000) {
    throw new RangeError('Invalid App Check local verification limit');
  }
  let utcDay = '';
  let used = 0;

  function reserve(now = Date.now()) {
    if (!Number.isSafeInteger(now) || now < 0) return false;
    const day = new Date(now).toISOString().slice(0, 10);
    if (day !== utcDay) {
      utcDay = day;
      used = 0;
    }
    if (used >= maxDaily) return false;
    used += 1;
    return true;
  }

  function remaining(now = Date.now()) {
    if (!Number.isSafeInteger(now) || now < 0) return 0;
    const day = new Date(now).toISOString().slice(0, 10);
    return day === utcDay ? Math.max(0, maxDaily - used) : maxDaily;
  }

  return Object.freeze({ reserve, remaining, maxDaily });
}

const defaultVerificationBudget = createAppCheckLocalBudget();

function isObservationEnabled(env = process.env) {
  return env.FIREBASE_APP_CHECK_OBSERVE_ENABLED === 'true'
    && env.FIREBASE_APP_CHECK_COST_GUARD_APPROVED === 'true'
    && env.FIREBASE_PROJECT_ID === EXPECTED_FIREBASE_PROJECT;
}

function readHeader(headers) {
  if (!headers || typeof headers !== 'object') return null;
  const token = headers[HEADER_NAME];
  return typeof token === 'string' ? token : null;
}

function validTokenShape(token) {
  return typeof token === 'string'
    && token.length >= 16
    && token.length <= 8192
    && /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token);
}

async function verifyWithExistingFirebaseAdmin(token) {
  const { getFirebaseAdmin } = require('./firebaseAdmin');
  const facade = getFirebaseAdmin();
  const app = facade?.apps?.[0];
  if (!app) throw new Error('Firebase Admin unavailable');
  const { getAppCheck } = require('firebase-admin/app-check');
  // Default verifyToken is signature/project/expiry validation, NOT replay protection.
  return getAppCheck(app).verifyToken(token);
}

/**
 * The result contains only an aggregate-safe status, never identifiers/tokens.
 * A missing token does NOT block the request: enforcement is out of scope.
 * expectedAppId must be the Firebase Android App ID (1:...:android:...),
 * obtained from the Firebase project, not the package name community.demos.
 */
async function observeAppCheckHeader(headers, {
  env = process.env,
  verifyToken = verifyWithExistingFirebaseAdmin,
  budget = defaultVerificationBudget,
} = {}) {
  if (!isObservationEnabled(env)) return { status: 'disabled' };

  const expectedAppId = env.FIREBASE_APP_CHECK_ANDROID_APP_ID;
  if (typeof expectedAppId !== 'string'
      || !/^1:\d+:android:[a-fA-F0-9]+$/.test(expectedAppId)) {
    return { status: 'unconfigured' };
  }

  const token = readHeader(headers);
  if (!token) return { status: 'missing' };
  if (!validTokenShape(token)) return { status: 'malformed' };

  // Reservation occurs AFTER both activation gates, App ID and token-shape
  // checks. Limited telemetry must never affect authorization or user access.
  if (!budget.reserve()) return { status: 'limited' };

  try {
    const response = await verifyToken(token);
    if (response?.appId !== expectedAppId) return { status: 'different_app' };
    return { status: 'verified' };
  } catch {
    // No exception objects, claims or raw tokens are logged or returned.
    return { status: 'invalid' };
  }
}

module.exports = {
  HEADER_NAME,
  EXPECTED_FIREBASE_PROJECT,
  isObservationEnabled,
  validTokenShape,
  createAppCheckLocalBudget,
  DEFAULT_MAX_VERIFICATIONS_PER_PROCESS_PER_DAY,
  observeAppCheckHeader,
};
