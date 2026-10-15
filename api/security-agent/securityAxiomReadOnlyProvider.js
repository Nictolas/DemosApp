const SECURITY_AXIOM_PROVIDER_VERSION = 'v0.94';
const DEFAULT_TIMEOUT_MS = 12_000;
const MAX_QUERY_LIMIT = 5_000;
const NON_PROD_DATASET_MARKER = /(staging|stage|sandbox|preview|test)/i;
const PROD_MARKER = /(^|[-_.])(prod|production)($|[-_.])/i;

function safeLabel(value, max = 96) {
  return String(value ?? '').trim().toLowerCase().replace(/[^a-z0-9_.:.-]/g, '_').slice(0, max);
}

function safeDataset(value) {
  return String(value ?? '').trim().replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 160);
}

function boundedInt(value, fallback, min, max) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= min && parsed <= max ? parsed : fallback;
}

function buildSecurityAxiomReadOnlyConfig(env = {}) {
  const enabled = env.SECURITY_AGENT_AXIOM_ENABLED === 'true';
  const queryOnly = env.SECURITY_AGENT_AXIOM_QUERY_ONLY === 'true';
  const environmentClass = safeLabel(env.SECURITY_AGENT_ENVIRONMENT_CLASS);
  const region = safeLabel(env.SECURITY_AGENT_AXIOM_REGION || 'eu', 24);
  const dataset = safeDataset(env.SECURITY_AGENT_AXIOM_DATASET);
  const timeoutMs = boundedInt(env.SECURITY_AGENT_AXIOM_TIMEOUT_MS, DEFAULT_TIMEOUT_MS, 1000, 30_000);
  const tokenPresent = typeof env.SECURITY_AGENT_AXIOM_API_TOKEN === 'string' && env.SECURITY_AGENT_AXIOM_API_TOKEN.trim().length >= 20;
  const orgIdPresent = typeof env.SECURITY_AGENT_AXIOM_ORG_ID === 'string' && env.SECURITY_AGENT_AXIOM_ORG_ID.trim().length > 0;
  const isolatedDataset = Boolean(dataset && NON_PROD_DATASET_MARKER.test(dataset) && !PROD_MARKER.test(dataset) && dataset.toLowerCase() !== 'real-time');
  const blockers = [];

  if (enabled) {
    if (environmentClass !== 'staging') blockers.push('environment_class_not_staging');
    if (!queryOnly) blockers.push('query_only_not_declared');
    if (region !== 'eu') blockers.push('region_not_eu');
    if (!dataset) blockers.push('dataset_missing');
    else if (!isolatedDataset) blockers.push('dataset_not_isolated');
    if (!tokenPresent) blockers.push('api_token_missing_or_invalid');
    if (!orgIdPresent) blockers.push('org_id_missing');
  }

  return Object.freeze({
    version: SECURITY_AXIOM_PROVIDER_VERSION,
    enabled,
    ready: enabled && blockers.length === 0,
    queryOnly,
    environmentClass: environmentClass || null,
    region,
    dataset: dataset || null,
    isolatedDataset,
    timeoutMs,
    tokenPresent,
    orgIdPresent,
    writeAccess: false,
    executable: false,
    blockers: Object.freeze(blockers)
  });
}

function providerError(code) {
  const error = new Error(code);
  error.code = code;
  return error;
}

function asDate(value, label) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw providerError(`SECURITY_AXIOM_${label}_INVALID`);
  return date;
}

function normalizeRows(result) {
  let rows = [];
  if (Array.isArray(result?.matches)) rows = result.matches;
  else if (Array.isArray(result?.data?.rows)) rows = result.data.rows;
  else if (Array.isArray(result?.rows)) rows = result.rows;
  else if (Array.isArray(result)) rows = result;

  return rows.map(record => {
    if (!record || typeof record !== 'object' || Array.isArray(record)) return record;
    const originalTime = record._time || record._sysTime;
    let value = record;
    if (record.data && typeof record.data === 'object' && !Array.isArray(record.data)) value = { ...record.data };
    else if (typeof record.data === 'string') {
      try { value = JSON.parse(record.data); } catch (_error) { value = { ...record }; }
    } else value = { ...record };
    if (value && typeof value === 'object' && !value._time && originalTime) value._time = originalTime;
    return value;
  });
}

class SecurityAxiomReadOnlyProvider {
  #client;

  constructor({ config, client } = {}) {
    if (!config || config.ready !== true) throw providerError('SECURITY_AXIOM_PROVIDER_NOT_READY');
    if (!client || typeof client.query !== 'function') throw providerError('SECURITY_AXIOM_CLIENT_INVALID');
    this.config = config;
    this.#client = client;
    this.queryOnly = true;
    this.writeAccess = false;
    this.executable = false;
  }

  async getSecurityEvents({ startTime, endTime, limit = 100 } = {}) {
    const start = asDate(startTime, 'START_TIME');
    const end = asDate(endTime, 'END_TIME');
    const boundedLimit = boundedInt(limit, 100, 1, MAX_QUERY_LIMIT);
    if (end.getTime() < start.getTime()) throw providerError('SECURITY_AXIOM_TIME_RANGE_INVALID');

    const fetchLimit = Math.min(MAX_QUERY_LIMIT, Math.max(boundedLimit, boundedLimit * 2));
    const aplQuery = `['${this.config.dataset}'] | order by _time asc | limit ${fetchLimit}`;
    let result;
    try {
      result = await this.#client.query(aplQuery, {
        startTime: start,
        endTime: end,
        timeout: this.config.timeoutMs
      });
    } catch (_error) {
      throw providerError('SECURITY_AXIOM_QUERY_FAILED');
    }

    return normalizeRows(result)
      .filter(record => record && typeof record === 'object' && record.type && record.severity)
      .slice(0, boundedLimit);
  }

  status() {
    return Object.freeze({
      version: SECURITY_AXIOM_PROVIDER_VERSION,
      enabled: true,
      ready: true,
      queryOnly: true,
      region: this.config.region,
      dataset: this.config.dataset,
      isolatedDataset: this.config.isolatedDataset === true,
      tokenPresent: this.config.tokenPresent === true,
      orgIdPresent: this.config.orgIdPresent === true,
      writeAccess: false,
      executable: false
    });
  }
}

function createSecurityAxiomReadOnlyProvider({ env = process.env, config = buildSecurityAxiomReadOnlyConfig(env), client = null, ClientCtor = null } = {}) {
  if (config.ready !== true) return null;
  let resolvedClient = client;
  if (!resolvedClient) {
    const ResolvedClient = ClientCtor || require('@axiomhq/axiom-node').Client;
    resolvedClient = new ResolvedClient({
      token: env.SECURITY_AGENT_AXIOM_API_TOKEN,
      orgId: env.SECURITY_AGENT_AXIOM_ORG_ID,
      region: config.region
    });
  }
  return new SecurityAxiomReadOnlyProvider({ config, client: resolvedClient });
}

module.exports = {
  SECURITY_AXIOM_PROVIDER_VERSION,
  DEFAULT_TIMEOUT_MS,
  MAX_QUERY_LIMIT,
  NON_PROD_DATASET_MARKER,
  PROD_MARKER,
  buildSecurityAxiomReadOnlyConfig,
  normalizeRows,
  SecurityAxiomReadOnlyProvider,
  createSecurityAxiomReadOnlyProvider
};
