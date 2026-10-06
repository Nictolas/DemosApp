const REQUIRED_RESEARCH_CLIENT_ADDRESS_TRUST_DECISIONS = Object.freeze([
  'deploymentProxyTopologyVerified',
  'directPeerProxyRangesVerified',
  'forwardedForSanitizationVerified',
  'trustedProxyHopCountRecorded',
  'ipv4Ipv6BehaviorVerified',
  'directAccessBypassPrevented'
]);

const evaluateResearchClientAddressTrust = (decisions = {}) => {
  const blockers = REQUIRED_RESEARCH_CLIENT_ADDRESS_TRUST_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  return Object.freeze({
    approved: blockers.length === 0,
    blockers: Object.freeze(blockers)
  });
};

module.exports = {
  REQUIRED_RESEARCH_CLIENT_ADDRESS_TRUST_DECISIONS,
  evaluateResearchClientAddressTrust
};
