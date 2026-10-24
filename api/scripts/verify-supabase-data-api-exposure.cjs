'use strict';

/**
 * Safe, read-only DEMOS Supabase Data API exposure smoke test.
 * Sends HEAD requests with limit=0; never fetches user records or response bodies.
 * Does not modify Supabase, PostgreSQL, Auth or configuration.
 *
 * Use a PUBLISHABLE / legacy ANON key ONLY. Never use service_role or secret keys.
 *
 * SUPABASE_PUBLIC_URL=https://<project>.supabase.co
 * SUPABASE_PUBLISHABLE_KEY=<sb_publishable_...>
 * node api/scripts/verify-supabase-data-api-exposure.cjs
 *
 * Exit 0: all sensitive probes rejected as expected.
 * Exit 1: at least one sensitive table endpoint accepted anonymous access.
 * Exit 2: unable to determine result reliably.
 */

const SENSITIVE_TABLES = Object.freeze([
  'users',
  'user_profile',
  'user_consents',
  'user_auth_providers',
  'user_devices',
  'user_rights_requests',
  'opinioni_risposte',
  'active_sessions',
  'verification_tokens',
  'identity_verifications',
  'political_selections'
]);

function validatePublicKey(key) {
  const value = String(key || '').trim();
  if (!value || value.startsWith('sb_secret_') || value.startsWith('sb_service_') || value.startsWith('sk_')) {
    throw new Error('Provide a public publishable or legacy anon key, never a secret/service key');
  }
  if (!value.startsWith('sb_publishable_') && !/^eyJ[A-Za-z0-9_-]+\./.test(value)) {
    throw new Error('Unrecognized key format: require sb_publishable_ or legacy JWT anon key');
  }
  if (value.startsWith('eyJ')) {
    try {
      const payload = JSON.parse(Buffer.from(value.split('.')[1], 'base64url').toString('utf8'));
      if (payload.role !== 'anon') throw new Error('Legacy JWT key is not an anon key');
    } catch {
      throw new Error('Legacy JWT key must have the anon role; service_role keys are forbidden');
    }
  }
  return value;
}

function buildProbeUrl(projectUrl, table) {
  const url = new URL(projectUrl);
  if (url.protocol !== 'https:') throw new Error('Supabase URL must use HTTPS');
  if (!/^[a-z_]+$/.test(table)) throw new Error('Unsafe table name');
  if (url.pathname !== '/' && url.pathname !== '') throw new Error('Provide a project URL, not an API endpoint');
  url.pathname = '/rest/v1/' + encodeURIComponent(table);
  url.searchParams.set('select', '*');
  url.searchParams.set('limit', '0');
  return url.toString();
}

function classifyStatus(status) {
  if (status >= 200 && status < 300) return 'endpoint-accessible';
  if ([401, 403, 404].includes(status)) return 'denied';
  return 'inconclusive';
}

async function probeOne({ projectUrl, publicKey, table, fetchImpl = fetch, timeoutMs = 7000 }) {
  const url = buildProbeUrl(projectUrl, table);
  const key = validatePublicKey(publicKey);
  const headers = { apikey: key };
  if (key.startsWith('eyJ')) headers.Authorization = 'Bearer ' + key;
  try {
    const response = await fetchImpl(url, {
      method: 'HEAD',
      headers,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'manual'
    });
    return { table, status: response.status, result: classifyStatus(response.status) };
  } catch {
    // Intentionally do not print URL, headers, body or thrown message.
    return { table, status: null, result: 'inconclusive' };
  }
}

async function audit({ projectUrl, publicKey, tables = SENSITIVE_TABLES, fetchImpl = fetch }) {
  const checks = [];
  for (const table of tables) {
    checks.push(await probeOne({ projectUrl, publicKey, table, fetchImpl }));
  }
  return {
    checks,
    accessible: checks.filter((c) => c.result === 'endpoint-accessible').map((c) => c.table),
    inconclusive: checks.filter((c) => c.result === 'inconclusive').map((c) => c.table)
  };
}

async function main() {
  const projectUrl = process.env.SUPABASE_PUBLIC_URL;
  const publicKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!projectUrl || !publicKey) {
    console.error('Missing SUPABASE_PUBLIC_URL and/or SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY)');
    process.exitCode = 2;
    return;
  }
  try {
    validatePublicKey(publicKey);
    const results = await audit({ projectUrl, publicKey });
    for (const check of results.checks) {
      console.log(check.table + ': ' + check.result + ' (' + (check.status ?? 'network-error') + ')');
    }
    if (results.accessible.length) {
      console.error('FAIL: Data API accepts anonymous HEAD requests for sensitive tables. No record was fetched.');
      process.exitCode = 1;
    } else if (results.inconclusive.length) {
      console.error('INCONCLUSIVE: Unable to verify some endpoints; do not assume they are protected.');
      process.exitCode = 2;
    } else {
      console.log('PASS: Sensitive table endpoints denied these anonymous requests.');
    }
    console.log('Note: This is an endpoint-level check; separately audit grants, RLS policies and other API paths.');
  } catch {
    console.error('INCONCLUSIVE: Invalid smoke-test configuration.');
    process.exitCode = 2;
  }
}

if (require.main === module) main();

module.exports = {
  SENSITIVE_TABLES,
  validatePublicKey,
  buildProbeUrl,
  classifyStatus,
  probeOne,
  audit
};
