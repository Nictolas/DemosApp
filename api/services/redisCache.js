const { Redis } = require('@upstash/redis');
const { keys, ttl } = require('../config/cacheKeys');

let _client;
let _missingEnvLogged;

function getClient() {
  if (_client !== undefined) return _client;
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    _client = null;
    if (!_missingEnvLogged) {
      _missingEnvLogged = true;
      console.warn(
        '⚠️ Upstash Redis non configurato (UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN): cache applicativa disabilitata.'
      );
    }
    return null;
  }
  _client = new Redis({ url, token });
  return _client;
}

function isEnabled() {
  return getClient() != null;
}

async function getJson(key) {
  const r = getClient();
  if (!r) return null;
  try {
    const raw = await r.get(key);
    if (raw == null) return null;
    if (typeof raw === 'string') return JSON.parse(raw);
    return raw;
  } catch (err) {
    console.error('redisCache getJson:', err.message);
    return null;
  }
}

async function setJson(key, value, ttlSeconds) {
  const r = getClient();
  if (!r) return;
  try {
    await r.set(key, JSON.stringify(value), { ex: ttlSeconds });
  } catch (err) {
    console.error('redisCache setJson:', err.message);
  }
}

async function del(key) {
  const r = getClient();
  if (!r) return;
  try {
    await r.del(key);
  } catch (err) {
    console.error('redisCache del:', err.message);
  }
}

/**
 * Read-through: se assente esegue fetcher(), salva in cache e ritorna.
 */
async function remember(key, ttlSeconds, fetcher) {
  const hit = await getJson(key);
  if (hit !== null) return hit;
  const data = await fetcher();
  await setJson(key, data, ttlSeconds);
  return data;
}

async function invalidateProgrammaCaches(userId) {
  await del(keys.programmiList);
  if (userId != null && userId !== '') await del(keys.programmaUser(String(userId)));
}

async function invalidateMinisteroIniziativeCache() {
  await del(keys.ministeroIniziativeDb);
}

module.exports = {
  getClient,
  isEnabled,
  getJson,
  setJson,
  del,
  remember,
  invalidateProgrammaCaches,
  invalidateMinisteroIniziativeCache,
  cacheKeys: keys,
  cacheTtl: ttl
};
