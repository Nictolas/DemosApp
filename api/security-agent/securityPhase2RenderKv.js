const Redis = require('ioredis');

const SECURITY_PHASE2_RENDER_KV_VERSION = 'v0.101';
const RENDER_KV_ID_PATTERN = /^red-[a-z0-9]+$/;
const RENDER_KV_PORT = '6379';

function parseRenderKvConnection(env = {}) {
  const enabled = env.SECURITY_PHASE2_RENDER_KV_ENABLED === 'true';
  const id = String(env.SECURITY_PHASE2_RENDER_KV_ID || '').trim().toLowerCase();
  const rawUrl = String(env.SECURITY_PHASE2_RENDER_KV_URL || '').trim();
  const blockers = [];
  let parsed = null;

  if (enabled) {
    if (!RENDER_KV_ID_PATTERN.test(id)) blockers.push('render_kv_id_invalid');
    try {
      parsed = new URL(rawUrl);
    } catch (_error) {
      blockers.push('render_kv_url_invalid');
    }
    if (parsed) {
      if (parsed.protocol !== 'redis:') blockers.push('render_kv_protocol_not_internal_redis');
      if (!RENDER_KV_ID_PATTERN.test(parsed.hostname)) blockers.push('render_kv_host_invalid');
      if (parsed.hostname !== id) blockers.push('render_kv_id_host_mismatch');
      if ((parsed.port || RENDER_KV_PORT) !== RENDER_KV_PORT) blockers.push('render_kv_port_invalid');
      if (parsed.username || parsed.password) blockers.push('render_kv_embedded_credentials_forbidden');
      if (parsed.search || parsed.hash || (parsed.pathname && parsed.pathname !== '/')) blockers.push('render_kv_url_shape_invalid');
    }
  }

  return { enabled, id: id || null, rawUrl, parsed, blockers: [...new Set(blockers)] };
}

function buildSecurityPhase2RenderKvConfig(env = {}) {
  const privateConfig = parseRenderKvConnection(env);
  return Object.freeze({
    version: SECURITY_PHASE2_RENDER_KV_VERSION,
    enabled: privateConfig.enabled,
    ready: privateConfig.enabled && privateConfig.blockers.length === 0,
    renderKvId: privateConfig.id,
    privateNetworkOnly: true,
    externalConnectionsRequired: false,
    authenticationRequired: false,
    productionWriteAllowed: false,
    stagingValidationWriteAllowed: privateConfig.enabled && privateConfig.blockers.length === 0,
    blockers: Object.freeze(privateConfig.blockers)
  });
}

function createSecurityPhase2RenderKvClient({ env = process.env, RedisCtor = Redis } = {}) {
  const config = buildSecurityPhase2RenderKvConfig(env);
  if (!config.enabled || !config.ready) {
    const error = new Error('SECURITY_PHASE2_RENDER_KV_BLOCKED');
    error.code = 'SECURITY_PHASE2_RENDER_KV_BLOCKED';
    error.blockers = config.blockers;
    throw error;
  }
  if (typeof RedisCtor !== 'function') throw new TypeError('Redis constructor required');
  const privateConfig = parseRenderKvConnection(env);
  const redis = new RedisCtor(privateConfig.rawUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: 3000,
    maxRetriesPerRequest: 0,
    retryStrategy: null
  });

  return Object.freeze({
    async connect() {
      if (redis.status === 'wait') await redis.connect();
      const pong = await redis.ping();
      if (pong !== 'PONG') throw new Error('SECURITY_PHASE2_RENDER_KV_PING_FAILED');
      return true;
    },
    async get(key) {
      return redis.get(String(key));
    },
    async set(key, value, options = {}) {
      const ttl = Math.max(1, Math.floor(Number(options.ex || 0)));
      if (!Number.isFinite(ttl)) throw new Error('SECURITY_PHASE2_RENDER_KV_TTL_INVALID');
      return redis.set(String(key), String(value), 'EX', ttl);
    },
    async del(key) {
      return redis.del(String(key));
    },
    disconnect() {
      redis.disconnect();
    }
  });
}

module.exports = {
  SECURITY_PHASE2_RENDER_KV_VERSION,
  buildSecurityPhase2RenderKvConfig,
  createSecurityPhase2RenderKvClient
};
