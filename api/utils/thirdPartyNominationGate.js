'use strict';

// A production merge must never implicitly activate collection/publication of
// third-party nominees. The switch is deliberately explicit and production-only:
// CI/local synthetic tests remain operable without touching the shared staging.
function isNominationWriteEnabled(env = process.env) {
  return env.NODE_ENV !== 'production' ||
    env.DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED === 'true';
}

function rejectUnavailableNomination(res) {
  res.set('Cache-Control', 'private, no-store');
  return res.status(503).json({success:false,error:'PROPOSTE_NON_DISPONIBILI'});
}

module.exports = {isNominationWriteEnabled,rejectUnavailableNomination};
