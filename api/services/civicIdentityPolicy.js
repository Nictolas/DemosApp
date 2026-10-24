'use strict';

// The server-side rollout switch for civic actions. Registration has its own
// independent DEMOS_REGISTRATION_IDENTITY_MODE policy.
const CIVIC_IDENTITY_MODES = Object.freeze({
  PROGRESSIVE: 'progressive',
  CIE_REQUIRED: 'cie_required',
});

function getCivicIdentityMode(env = process.env) {
  const raw = String(env.DEMOS_CIVIC_IDENTITY_MODE || '').trim().toLowerCase();
  if (!raw) return CIVIC_IDENTITY_MODES.PROGRESSIVE;
  if (Object.values(CIVIC_IDENTITY_MODES).includes(raw)) return raw;
  throw new Error('DEMOS_CIVIC_IDENTITY_MODE non valido');
}

function isCieRequiredForCivicActions(env = process.env) {
  return getCivicIdentityMode(env) === CIVIC_IDENTITY_MODES.CIE_REQUIRED;
}

module.exports = {
  CIVIC_IDENTITY_MODES,
  getCivicIdentityMode,
  isCieRequiredForCivicActions,
};
