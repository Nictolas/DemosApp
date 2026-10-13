'use strict';

const REGISTRATION_IDENTITY_MODES = Object.freeze({
  PROGRESSIVE: 'progressive',
  CIE_REQUIRED: 'cie_required',
});

function getRegistrationIdentityMode(env = process.env) {
  const raw = String(env.DEMOS_REGISTRATION_IDENTITY_MODE || '').trim().toLowerCase();
  if (!raw) return REGISTRATION_IDENTITY_MODES.PROGRESSIVE;
  if (Object.values(REGISTRATION_IDENTITY_MODES).includes(raw)) return raw;
  throw new Error(`DEMOS_REGISTRATION_IDENTITY_MODE non valido: ${raw}`);
}

function isCieRequiredForRegistration(env = process.env) {
  return getRegistrationIdentityMode(env) === REGISTRATION_IDENTITY_MODES.CIE_REQUIRED;
}

module.exports = {
  REGISTRATION_IDENTITY_MODES,
  getRegistrationIdentityMode,
  isCieRequiredForRegistration,
};