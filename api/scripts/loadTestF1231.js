'use strict';

const { performance } = require('node:perf_hooks');

const LOCAL_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const DEFAULT_DURATION_MS = 10_000;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_CONCURRENCY = 4;
const DEFAULT_BURST_MULTIPLIER = 5;
const MAX_DEFAULT_CONCURRENCY = 50;

const READ_CASES = Object.freeze([
  Object.freeze({ name: 'auth-me', method: 'GET', path: '/api/auth/me', expectedStatuses: [200] }),
  Object.freeze({ name: 'eventi', method: 'GET', path: '/api/eventi', expectedStatuses: [200] }),
  Object.freeze({ name: 'opinioni', method: 'GET', path: '/api/opinioni', expectedStatuses: [200] }),
  Object.freeze({ name: 'opinioni-profile', method: 'GET', path: '/api/opinioni/profile', expectedStatuses: [200] }),
]);

const MIXED_MUTATION_CASES = Object.freeze([
  Object.freeze({
    name: 'political-selection-clear-camera',
    method: 'PUT',
    path: '/api/users/{userId}/political-selection',
    expectedStatuses: [200],
    mutation: true,
    body: Object.freeze({
      kind: 'representative',
      officeId: 'it.camera',
      selectedUserId: null,
      source: 'podio',
    }),
  }),
]);

function toPositiveInteger(value, fallback, label) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error(`${label} must be a positive integer`);
  return parsed;
}

function percentile(values, fraction) {
  if (!Array.isArray(values) || values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = Math.max(0, Math.min(sorted.length - 1, Math.ceil(fraction * sorted.length) - 1));
  return sorted[position];
}

function validateTarget(baseUrl, env = process.env) {
  let parsed;
  try {
    parsed = new URL(baseUrl);
  } catch (_error) {
    throw new Error('DEMOS load target must be a valid absolute URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('DEMOS load target must use http or https');

  const host = parsed.hostname.toLowerCase();
  const local = LOCAL_HOSTS.has(host);
  if (local) return { url: parsed, local: true };

  if (env.NODE_ENV !== 'staging') {
    throw new Error('Remote F12-31 load tests are allowed only with NODE_ENV=staging');
  }
  if (env.DEMOS_LOAD_ALLOW_REMOTE !== 'true') {
    throw new Error('Set DEMOS_LOAD_ALLOW_REMOTE=true to run F12-31 against a remote staging target');
  }

  const explicitHost = String(env.DEMOS_LOAD_ALLOWED_HOST || '').trim().toLowerCase();
  if (explicitHost) {
    if (host !== explicitHost) throw new Error(`Remote load target host ${host} is not DEMOS_LOAD_ALLOWED_HOST`);
  } else if (!host.includes('staging')) {
    throw new Error('Remote F12-31 target must be an explicit staging host or match DEMOS_LOAD_ALLOWED_HOST');
  }

  return { url: parsed, local: false };
}

function buildProfile({ profile = 'read-heavy', userId = null, allowMutations = false } = {}) {
  const normalized = String(profile || '').trim().toLowerCase();
  if (normalized === 'read-heavy') {
    return { id: normalized, cases: [...READ_CASES], burst: false, mutations: false };
  }
  if (normalized === 'burst') {
    return { id: normalized, cases: [...READ_CASES], burst: true, mutations: false };
  }
  if (normalized === 'mixed') {
    if (!allowMutations) {
      throw new Error('mixed profile requires DEMOS_LOAD_ALLOW_MUTATIONS=true');
    }
    if (!userId) throw new Error('mixed profile requires DEMOS_LOAD_USER_ID');
    return {
      id: normalized,
      cases: [...READ_CASES, ...MIXED_MUTATION_CASES],
      burst: false,
      mutations: true,
    };
  }
  throw new Error(`Unsupported F12-31 profile: ${profile}`);
}

function expandCase(testCase, { userId } = {}) {
  const path = testCase.path.replace('{userId}', encodeURIComponent(String(userId || '')));
  if (path.includes('{userId}')) throw new Error(`Unable to resolve userId for ${testCase.name}`);
  return { ...testCase, path };
}

function summarizeEndpoint(records) {
  const byEndpoint = new Map();
  for (const record of records) {
    const bucket = byEndpoint.get(record.name) || [];
    bucket.push(record);
    byEndpoint.set(record.name, bucket);
  }
  return Object.fromEntries([...byEndpoint.entries()].map(([name, items]) => {
    const latencies = items.map((item) => item.latencyMs);
    const failed = items.filter((item) => !item.ok).length;
    return [name, {
      requests: items.length,
      failed,
      errorRate: items.length ? failed / items.length : 0,
      latencyMs: {
        p50: percentile(latencies, 0.50),
        p95: percentile(latencies, 0.95),
        p99: percentile(latencies, 0.99),
        max: latencies.length ? Math.max(...latencies) : null,
      },
      bytes: items.reduce((sum, item) => sum + item.bytes, 0),
    }];
  }));
}

async function runLoadProfile({
  baseUrl,
  token,
  userId = null,
  profile = 'read-heavy',
  durationMs = DEFAULT_DURATION_MS,
  requestCount = null,
  concurrency = DEFAULT_CONCURRENCY,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  burstMultiplier = DEFAULT_BURST_MULTIPLIER,
  fetchImpl = global.fetch,
  env = process.env,
  logger = console,
} = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for F12-31 load tests');
  if (!baseUrl) throw new Error('F12-31 requires a baseUrl');
  if (!token) throw new Error('F12-31 requires an authenticated DEMOS_LOAD_TOKEN');

  const target = validateTarget(baseUrl, env);
  const allowMutations = env.DEMOS_LOAD_ALLOW_MUTATIONS === 'true';
  const profileDefinition = buildProfile({ profile, userId, allowMutations });

  const normalizedDurationMs = toPositiveInteger(durationMs, DEFAULT_DURATION_MS, 'durationMs');
  const normalizedTimeoutMs = toPositiveInteger(timeoutMs, DEFAULT_TIMEOUT_MS, 'timeoutMs');
  const normalizedRequestCount = requestCount == null
    ? null
    : toPositiveInteger(requestCount, null, 'requestCount');
  let normalizedConcurrency = toPositiveInteger(concurrency, DEFAULT_CONCURRENCY, 'concurrency');
  const normalizedBurstMultiplier = toPositiveInteger(burstMultiplier, DEFAULT_BURST_MULTIPLIER, 'burstMultiplier');
  if (profileDefinition.burst) normalizedConcurrency *= normalizedBurstMultiplier;

  if (normalizedConcurrency > MAX_DEFAULT_CONCURRENCY && env.DEMOS_LOAD_ALLOW_HIGH_CONCURRENCY !== 'true') {
    throw new Error(`concurrency ${normalizedConcurrency} exceeds safe default ${MAX_DEFAULT_CONCURRENCY}; set DEMOS_LOAD_ALLOW_HIGH_CONCURRENCY=true only on isolated staging`);
  }

  const cases = profileDefinition.cases.map((item) => expandCase(item, { userId }));
  const records = [];
  let sequence = 0;
  const runStart = performance.now();
  const deadline = runStart + normalizedDurationMs;

  const issueRequest = async (testCase) => {
    const headers = { Authorization: `Bearer ${token}` };
    const options = {
      method: testCase.method,
      headers,
      signal: AbortSignal.timeout(normalizedTimeoutMs),
    };
    if (testCase.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      options.body = JSON.stringify(testCase.body);
    }

    const startedAt = performance.now();
    try {
      const response = await fetchImpl(new URL(testCase.path, target.url), options);
      let bytes = 0;
      try {
        const body = await response.arrayBuffer();
        bytes = body.byteLength;
      } catch (_bodyError) {
        bytes = 0;
      }
      const latencyMs = performance.now() - startedAt;
      const ok = testCase.expectedStatuses.includes(response.status);
      records.push({ name: testCase.name, method: testCase.method, status: response.status, ok, latencyMs, bytes });
    } catch (error) {
      const latencyMs = performance.now() - startedAt;
      records.push({
        name: testCase.name,
        method: testCase.method,
        status: 'NETWORK_ERROR',
        ok: false,
        latencyMs,
        bytes: 0,
        error: error?.name || error?.message || String(error),
      });
    }
  };

  const worker = async () => {
    while (true) {
      const index = sequence;
      if (normalizedRequestCount != null) {
        if (index >= normalizedRequestCount) return;
      } else if (performance.now() >= deadline && index >= normalizedConcurrency) {
        return;
      }
      sequence += 1;
      await issueRequest(cases[index % cases.length]);
    }
  };

  await Promise.all(Array.from({ length: normalizedConcurrency }, () => worker()));
  const elapsedMs = performance.now() - runStart;
  const latencies = records.map((record) => record.latencyMs);
  const failed = records.filter((record) => !record.ok).length;
  const statusCounts = {};
  for (const record of records) statusCounts[record.status] = (statusCounts[record.status] || 0) + 1;

  const result = {
    profile: profileDefinition.id,
    target: `${target.url.protocol}//${target.url.host}`,
    localTarget: target.local,
    mutations: profileDefinition.mutations,
    configuredConcurrency: normalizedConcurrency,
    completedRequests: records.length,
    failedRequests: failed,
    errorRate: records.length ? failed / records.length : 0,
    elapsedMs,
    rps: elapsedMs > 0 ? records.length / (elapsedMs / 1000) : 0,
    latencyMs: {
      p50: percentile(latencies, 0.50),
      p95: percentile(latencies, 0.95),
      p99: percentile(latencies, 0.99),
      max: latencies.length ? Math.max(...latencies) : null,
    },
    bytesReceived: records.reduce((sum, record) => sum + record.bytes, 0),
    statusCounts,
    endpoints: summarizeEndpoint(records),
  };

  logger.log(`[F12-31] profile=${result.profile} requests=${result.completedRequests} failed=${result.failedRequests} rps=${result.rps.toFixed(2)} p95=${result.latencyMs.p95?.toFixed?.(1) ?? 'n/a'}ms`);
  return result;
}

function parseArgs(argv = process.argv.slice(2)) {
  const args = {};
  for (const token of argv) {
    if (!token.startsWith('--')) continue;
    const [key, ...rest] = token.slice(2).split('=');
    args[key] = rest.length ? rest.join('=') : 'true';
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const env = process.env;
  const result = await runLoadProfile({
    baseUrl: args['base-url'] || env.DEMOS_LOAD_BASE_URL || `http://127.0.0.1:${env.PORT || 3001}`,
    token: env.DEMOS_LOAD_TOKEN,
    userId: env.DEMOS_LOAD_USER_ID || null,
    profile: args.profile || env.DEMOS_LOAD_PROFILE || 'read-heavy',
    durationMs: args['duration-ms'] || env.DEMOS_LOAD_DURATION_MS || DEFAULT_DURATION_MS,
    requestCount: args.requests || env.DEMOS_LOAD_REQUESTS || null,
    concurrency: args.concurrency || env.DEMOS_LOAD_CONCURRENCY || DEFAULT_CONCURRENCY,
    timeoutMs: args['timeout-ms'] || env.DEMOS_LOAD_TIMEOUT_MS || DEFAULT_TIMEOUT_MS,
    burstMultiplier: args['burst-multiplier'] || env.DEMOS_LOAD_BURST_MULTIPLIER || DEFAULT_BURST_MULTIPLIER,
    env,
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (result.failedRequests > 0) process.exitCode = 2;
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`[F12-31] ${error.message}`);
    process.exitCode = 1;
  });
}

module.exports = {
  READ_CASES,
  MIXED_MUTATION_CASES,
  DEFAULT_DURATION_MS,
  DEFAULT_TIMEOUT_MS,
  DEFAULT_CONCURRENCY,
  DEFAULT_BURST_MULTIPLIER,
  MAX_DEFAULT_CONCURRENCY,
  percentile,
  validateTarget,
  buildProfile,
  runLoadProfile,
  parseArgs,
};
