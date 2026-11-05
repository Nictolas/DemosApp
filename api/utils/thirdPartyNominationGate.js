'use strict';

// Collection/publication of third-party nominees is disabled by default in
// EVERY runtime, including misconfigured deployments (missing NODE_ENV),
// preview, staging, development and CI. The real DB must never be writable by
// merely pretending to use a synthetic test environment. Only an exact,
// explicit operator opt-in enables writes; rejection/withdrawal still work.
function isNominationWriteEnabled(env = process.env) {
  return env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED === 'true';
}

// Grazia may involve data about convictions or offences (GDPR Article 10).
// A general nomination rollout must NEVER silently activate this category:
// its collection and approval need a second, separately authorized opt-in.
function isGraziaNominationWriteEnabled(env = process.env) {
  return isNominationWriteEnabled(env) &&
    env.DEMOS_GRAZIA_NOMINATIONS_ENABLED === 'true';
}

function rejectUnavailableNomination(res) {
  res.set('Cache-Control', 'private, no-store');
  return res.status(503).json({success:false,error:'PROPOSTE_NON_DISPONIBILI'});
}

module.exports = {isNominationWriteEnabled,isGraziaNominationWriteEnabled,rejectUnavailableNomination};
