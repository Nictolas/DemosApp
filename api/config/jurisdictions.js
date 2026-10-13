'use strict';

const JURISDICTION_LEVELS = Object.freeze({
  SUPRANATIONAL: 'supranational',
  COUNTRY: 'country',
});

const JURISDICTIONS = Object.freeze({
  eu: Object.freeze({
    id: 'eu',
    code: 'EU',
    name: 'Unione europea',
    level: JURISDICTION_LEVELS.SUPRANATIONAL,
    parentId: null,
    defaultLocale: 'en',
  }),
  it: Object.freeze({
    id: 'it',
    code: 'IT',
    name: 'Italia',
    level: JURISDICTION_LEVELS.COUNTRY,
    parentId: 'eu',
    defaultLocale: 'it-IT',
  }),
  us: Object.freeze({
    id: 'us',
    code: 'US',
    name: 'Stati Uniti d’America',
    level: JURISDICTION_LEVELS.COUNTRY,
    parentId: null,
    defaultLocale: 'en-US',
  }),
});

function validateJurisdictions() {
  const errors = [];
  const codes = new Set();
  for (const jurisdiction of Object.values(JURISDICTIONS)) {
    if (!jurisdiction.id || !jurisdiction.code || !jurisdiction.name || !jurisdiction.level) {
      errors.push(`JURISDICTION_INCOMPLETE:${jurisdiction.id || 'unknown'}`);
    }
    const normalizedCode = String(jurisdiction.code || '').trim().toUpperCase();
    if (normalizedCode && codes.has(normalizedCode)) errors.push(`JURISDICTION_CODE_DUPLICATE:${normalizedCode}`);
    if (normalizedCode) codes.add(normalizedCode);
    if (jurisdiction.parentId && !JURISDICTIONS[jurisdiction.parentId]) {
      errors.push(`JURISDICTION_PARENT_UNKNOWN:${jurisdiction.id}:${jurisdiction.parentId}`);
    }
  }
  return Object.freeze({ valid: errors.length === 0, errors: Object.freeze(errors) });
}

module.exports = {
  JURISDICTION_LEVELS,
  JURISDICTIONS,
  validateJurisdictions,
};
