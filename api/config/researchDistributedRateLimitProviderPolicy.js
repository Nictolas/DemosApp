const REQUIRED_DISTRIBUTED_RATE_LIMIT_PROVIDER_DECISIONS = Object.freeze([
  'atomicIncrementWithTtlSupported',
  'sharedAcrossResearchInstances',
  'tlsInTransitRequired',
  'authenticationRequired',
  'researchNamespaceIsolated',
  'dataRegionApproved',
  'retentionLimitedToRateLimitWindow',
  'noRawCitizenIdentifierStored'
]);

const evaluateResearchDistributedRateLimitProvider = (decisions = {}) => {
  const blockers = REQUIRED_DISTRIBUTED_RATE_LIMIT_PROVIDER_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  return Object.freeze({
    approved: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_DISTRIBUTED_RATE_LIMIT_PROVIDER_DECISIONS,
  evaluateResearchDistributedRateLimitProvider
};
