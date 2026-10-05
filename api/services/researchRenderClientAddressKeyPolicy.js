const {
  RENDER_RESEARCH_CLIENT_ADDRESS_HEADER,
  evaluateResearchRenderClientAddressProfile
} = require('../config/researchRenderClientAddressProfilePolicy');
const {
  normalizeIpLiteral
} = require('./researchClientAddressKeyPolicy');

const MAX_RENDER_CLIENT_ADDRESS_HEADER_LENGTH = 128;

const requestHeader = (req, name) => {
  if (req && typeof req.get === 'function') return req.get(name);
  return req?.headers?.[String(name).toLowerCase()];
};

const parseTrustedSingleIpHeader = (value) => {
  if (
    typeof value !== 'string' ||
    value.length === 0 ||
    value.length > MAX_RENDER_CLIENT_ADDRESS_HEADER_LENGTH ||
    value.includes(',')
  ) {
    throw new Error('Research trusted client-address header is invalid');
  }
  return normalizeIpLiteral(value);
};

const createResearchRenderClientAddressKeyGenerator = ({
  profileDecisions
} = {}) => {
  const profile = evaluateResearchRenderClientAddressProfile(profileDecisions);
  if (!profile.approved) {
    throw new Error(
      'Research Render client-address profile evidence is incomplete: ' + profile.blockers.join(',')
    );
  }

  return (req) => parseTrustedSingleIpHeader(
    requestHeader(req, RENDER_RESEARCH_CLIENT_ADDRESS_HEADER)
  );
};

module.exports = {
  MAX_RENDER_CLIENT_ADDRESS_HEADER_LENGTH,
  requestHeader,
  parseTrustedSingleIpHeader,
  createResearchRenderClientAddressKeyGenerator
};
