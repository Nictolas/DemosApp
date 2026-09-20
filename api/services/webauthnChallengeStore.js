const redisCache = require('./redisCache');
const { keys, ttl } = require('../config/cacheKeys');
const { atomicGetAndDelete } = require('./webauthnAtomicConsume');

const allowLocalFallback = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
const localFallback = new Map();

function getChallengeTtlSeconds() {
  const configured = Number(ttl.webAuthnChallenge);
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 300;
}

function assertKeyPart(value, label) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${label} non valido per challenge WebAuthn`);
  }
  return value.trim();
}

function keyFor(kind, id) {
  const keyPart = assertKeyPart(id, kind === 'register' ? 'userId' : 'loginKey');
  return kind === 'register'
    ? keys.webAuthnRegistrationChallenge(keyPart)
    : keys.webAuthnLoginChallenge(keyPart);
}

function parseStoredValue(raw) {
  if (raw == null) return null;
  if (typeof raw === 'string') return JSON.parse(raw);
  return raw;
}

function unavailableError(cause) {
  const error = new Error('Store challenge WebAuthn non disponibile');
  error.code = 'WEBAUTHN_CHALLENGE_STORE_UNAVAILABLE';
  if (cause) error.cause = cause;
  return error;
}

function pruneLocalFallback() {
  const now = Date.now();
  for (const [key, entry] of localFallback.entries()) {
    if (!entry || entry.expiresAt <= now) localFallback.delete(key);
  }
}

function setLocal(key, value) {
  pruneLocalFallback();
  localFallback.set(key, {
    value,
    expiresAt: Date.now() + getChallengeTtlSeconds() * 1000,
  });
}

function consumeLocal(key) {
  pruneLocalFallback();
  const entry = localFallback.get(key);
  if (!entry) return null;
  localFallback.delete(key);
  return entry.value;
}

async function setChallenge(kind, id, value) {
  const key = keyFor(kind, id);
  const client = redisCache.getClient();

  if (client) {
    try {
      await client.set(key, JSON.stringify(value), { ex: getChallengeTtlSeconds() });
      return;
    } catch (error) {
      throw unavailableError(error);
    }
  }

  if (!allowLocalFallback) {
    throw unavailableError();
  }

  // Solo sviluppo/test: fallback locale con la stessa scadenza del Redis store.
  setLocal(key, value);
}

async function consumeChallenge(kind, id) {
  const key = keyFor(kind, id);
  const client = redisCache.getClient();

  if (client) {
    try {
      // Consumo atomico: GETDEL nativo oppure fallback Lua con EVAL.
      const raw = await atomicGetAndDelete(client, key);
      return parseStoredValue(raw);
    } catch (error) {
      throw unavailableError(error);
    }
  }

  if (!allowLocalFallback) {
    throw unavailableError();
  }

  return consumeLocal(key);
}

module.exports = {
  setRegistrationChallenge: (userId, value) => setChallenge('register', userId, value),
  consumeRegistrationChallenge: (userId) => consumeChallenge('register', userId),
  setLoginChallenge: (loginKey, value) => setChallenge('login', loginKey, value),
  consumeLoginChallenge: (loginKey) => consumeChallenge('login', loginKey),
};
