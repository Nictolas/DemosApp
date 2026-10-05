const net = require('node:net');

const MAX_RESEARCH_FORWARDED_CHAIN_LENGTH = 8;
const MAX_RESEARCH_TRUSTED_PROXY_HOPS = 4;

const normalizeIpLiteral = (value) => {
  let candidate = String(value || '').trim();
  if (candidate.startsWith('[') && candidate.endsWith(']')) {
    candidate = candidate.slice(1, -1);
  }
  if (candidate.toLowerCase().startsWith('::ffff:')) {
    const mapped = candidate.slice(7);
    if (net.isIP(mapped) === 4) return mapped;
  }
  if (net.isIP(candidate) === 0) {
    throw new Error('Research client address is invalid');
  }
  return candidate.toLowerCase();
};

const parseForwardedFor = (value) => {
  if (typeof value !== 'string' || value.length === 0 || value.length > 1024) {
    throw new Error('Research forwarded-for header is invalid');
  }
  const chain = value.split(',').map((item) => normalizeIpLiteral(item));
  if (chain.length === 0 || chain.length > MAX_RESEARCH_FORWARDED_CHAIN_LENGTH) {
    throw new Error('Research forwarded-for chain is invalid');
  }
  return Object.freeze(chain);
};

const requestHeader = (req, name) => {
  if (req && typeof req.get === 'function') return req.get(name);
  return req?.headers?.[String(name).toLowerCase()];
};

const createResearchClientAddressKeyGenerator = ({
  trustedProxyHops,
  isTrustedProxyAddress
} = {}) => {
  if (!Number.isInteger(trustedProxyHops) || trustedProxyHops < 0 || trustedProxyHops > MAX_RESEARCH_TRUSTED_PROXY_HOPS) {
    throw new Error('Research trusted proxy hop count is invalid');
  }
  if (trustedProxyHops > 0 && typeof isTrustedProxyAddress !== 'function') {
    throw new Error('Research trusted proxy address policy is required');
  }

  return (req) => {
    const directPeer = normalizeIpLiteral(req?.socket?.remoteAddress);
    const forwardedFor = requestHeader(req, 'X-Forwarded-For');

    if (trustedProxyHops === 0) {
      if (forwardedFor !== undefined) {
        throw new Error('Research forwarded-for header is not allowed without trusted proxy');
      }
      return directPeer;
    }

    if (isTrustedProxyAddress(directPeer) !== true) {
      throw new Error('Research direct peer is not a trusted proxy');
    }

    const chain = parseForwardedFor(forwardedFor);
    if (chain.length < trustedProxyHops) {
      throw new Error('Research forwarded-for chain is shorter than trusted proxy topology');
    }

    const firstTrustedProxyIndex = chain.length - trustedProxyHops + 1;
    for (let index = firstTrustedProxyIndex; index < chain.length; index += 1) {
      if (isTrustedProxyAddress(chain[index]) !== true) {
        throw new Error('Research forwarded-for chain contains an untrusted proxy hop');
      }
    }

    return chain[chain.length - trustedProxyHops];
  };
};

module.exports = {
  MAX_RESEARCH_FORWARDED_CHAIN_LENGTH,
  MAX_RESEARCH_TRUSTED_PROXY_HOPS,
  normalizeIpLiteral,
  parseForwardedFor,
  createResearchClientAddressKeyGenerator
};
