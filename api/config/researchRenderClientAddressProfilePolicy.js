const RENDER_RESEARCH_CLIENT_ADDRESS_HEADER = 'CF-Connecting-IP';

const REQUIRED_RENDER_CLIENT_ADDRESS_PROFILE_DECISIONS = Object.freeze([
  'renderWebServiceVerified',
  'renderManagedPublicIngressVerified',
  'directServicePortNotPubliclyReachableVerified',
  'cfConnectingIpOverwriteVerified',
  'ipv4Ipv6HeaderBehaviorVerified'
]);

const evaluateResearchRenderClientAddressProfile = (decisions = {}) => {
  const blockers = REQUIRED_RENDER_CLIENT_ADDRESS_PROFILE_DECISIONS.filter(
    (key) => decisions[key] !== true
  );

  return Object.freeze({
    approved: blockers.length === 0,
    blockers: Object.freeze(blockers),
    headerName: RENDER_RESEARCH_CLIENT_ADDRESS_HEADER
  });
};

module.exports = {
  RENDER_RESEARCH_CLIENT_ADDRESS_HEADER,
  REQUIRED_RENDER_CLIENT_ADDRESS_PROFILE_DECISIONS,
  evaluateResearchRenderClientAddressProfile
};
