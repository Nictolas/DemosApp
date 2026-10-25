'use strict';

// User-generated candidate/representative selections are distinct from public
// mandates or verified institutional records. They must not appear in ordinary
// profile responses if the subject withdrew Article 9 consent.
const { getLegacySelectionFields } = require('./politicalJurisdictionRegistryService');

const PERSONAL_SELECTION_FIELDS = Object.freeze(getLegacySelectionFields('both'));

function maskPoliticalSelectionsWithoutConsent(profile, consentGranted) {
  if (!profile || typeof profile !== 'object') return profile;
  // Only the explicit boolean true grants disclosure. Absent/error states fail
  // closed at the caller, which must check the current database consent state.
  if (consentGranted === true) return { ...profile };

  const masked = { ...profile };
  for (const field of PERSONAL_SELECTION_FIELDS) {
    // Keep the shape used by legacy clients, even with SELECT * fallbacks.
    masked[field] = null;
  }
  return masked;
}

module.exports = { PERSONAL_SELECTION_FIELDS, maskPoliticalSelectionsWithoutConsent };
