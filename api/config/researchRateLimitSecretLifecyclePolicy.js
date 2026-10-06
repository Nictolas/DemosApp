const REQUIRED_RATE_LIMIT_SECRET_DECISIONS = Object.freeze([
  'secretStoredOutsideSourceControl',
  'secretAtLeast32Bytes',
  'separateFromIdentitySecrets',
  'rotationProcedureDocumented',
  'revocationProcedureDocumented',
  'accessRestrictedToResearchService'
]);

const evaluateResearchRateLimitSecretLifecycle = (decisions = {}) => {
  const blockers = REQUIRED_RATE_LIMIT_SECRET_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  return Object.freeze({
    approved: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_RATE_LIMIT_SECRET_DECISIONS,
  evaluateResearchRateLimitSecretLifecycle
};
