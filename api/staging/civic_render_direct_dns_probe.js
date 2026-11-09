'use strict';

// DNS-only staging connectivity prerequisite. This cannot open a PostgreSQL
// connection, read credentials, access any table, send push, or authorize GO.
const dns = require('node:dns').promises;

async function probeCivicStagingDirectDns({
  env = process.env,
  resolve4 = dns.resolve4,
  resolve6 = dns.resolve6,
} = {}) {
  if (env.CIVIC_STAGING_DNS_CHECK !== 'true') return 'NOT_TESTED';
  const project = env.CIVIC_STAGING_PROJECT_REF;
  if (typeof project !== 'string' || !/^[a-z0-9]{20}$/.test(project)) {
    return 'INVALID_STAGING_PROJECT';
  }
  // Project ref is fixed by the deployment operator, never by HTTP input.
  const hostname = `db.${project}.supabase.co`;
  const [ipv4, ipv6] = await Promise.allSettled([
    resolve4(hostname),
    resolve6(hostname),
  ]);
  const has4 = ipv4.status === 'fulfilled' &&
    Array.isArray(ipv4.value) && ipv4.value.length > 0;
  const has6 = ipv6.status === 'fulfilled' &&
    Array.isArray(ipv6.value) && ipv6.value.length > 0;
  if (has4 && has6) return 'DIRECT_DUAL_STACK';
  if (has4) return 'DIRECT_IPV4_AVAILABLE';
  if (has6) return 'DIRECT_IPV6_ONLY';
  return 'DIRECT_DNS_UNAVAILABLE';
}

module.exports = { probeCivicStagingDirectDns };
