const REQUIRED_PUBLIC_ORIGIN_DECISIONS = Object.freeze([
  'explicitAllowlistRequired',
  'wildcardOriginsForbidden',
  'credentialsWithWildcardForbidden',
  'httpsRequiredOutsideLocalDevelopment',
  'originNormalizationDefined',
  'unknownOriginsRejected',
  'preflightPolicyDefined',
  'productionOriginsDocumented'
]);

const evaluateResearchPublicOrigins = (decisions = {}) => {
  const blockers = REQUIRED_PUBLIC_ORIGIN_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  return Object.freeze({
    approved: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_PUBLIC_ORIGIN_DECISIONS,
  evaluateResearchPublicOrigins
};
