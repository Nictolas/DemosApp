const crypto = require('crypto');
const redisCache = require('./redisCache');
const { IDENTITY_ERROR_CODES } = require('../constants/identityVerification');

const TTL_SECONDS = 5 * 60;
const RELEASE_LOCK_SCRIPT = `
if redis.call("GET", KEYS[1]) == ARGV[1] then
  return redis.call("DEL", KEYS[1])
end
return 0
`;
const GET_AND_DELETE_SCRIPT = `
local value = redis.call("GET", KEYS[1])
if value then
  redis.call("DEL", KEYS[1])
end
return value
`;

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function transactionKey(state) {
  if (typeof state !== 'string' || state.length < 32) {
    throw new Error('State CIE non valido');
  }
  return `cie:oidc:tx:${hashValue(state)}`;
}

function userLockKey(userId) {
  if (!userId) throw new Error('userId obbligatorio');
  return `cie:oidc:user:${hashValue(userId)}`;
}

function registrationLockKey(registrationKey) {
  if (!registrationKey) throw new Error('registrationKey obbligatorio');
  return `cie:oidc:registration:${hashValue(registrationKey)}`;
}

function transactionOwnerKey(state) {
  return `cie:oidc:tx-owner:${hashValue(state)}`;
}

function isValidOwnerLockKey(key) {
  return typeof key === 'string' && /^cie:oidc:(user|registration):[a-f0-9]{64}$/.test(key);
}

function transactionLockValue(state) {
  return hashValue(state);
}

function createActiveTransactionError() {
  const error = new Error('Verifica CIE gia in corso');
  error.code = IDENTITY_ERROR_CODES.CIE_TRANSACTION_ALREADY_ACTIVE;
  return error;
}

async function releaseOwnerLockKeyIfOwned(key, state, client) {
  if (typeof client.eval !== 'function') {
    throw new Error('Redis EVAL richiesto per rilascio lock CIE');
  }
  if (!isValidOwnerLockKey(key)) {
    throw new Error('Chiave lock CIE non valida');
  }
  const expected = transactionLockValue(state);
  await client.eval(RELEASE_LOCK_SCRIPT, [key], [expected]);
}

async function releaseUserLockIfOwned(userId, state, client) {
  return releaseOwnerLockKeyIfOwned(userLockKey(userId), state, client);
}

async function getAndDelete(client, key) {
  if (typeof client.getdel === 'function') return client.getdel(key);
  if (typeof client.eval !== 'function') {
    throw new Error('Redis GETDEL o EVAL richiesto per consumo transazione CIE');
  }
  return client.eval(GET_AND_DELETE_SCRIPT, [key], []);
}

async function saveTransactionWithOwnerLock(lockKey, payload, transaction, client) {
  const lockValue = transactionLockValue(transaction.state);
  const lockResult = await client.set(lockKey, lockValue, {
    ex: TTL_SECONDS,
    nx: true
  });
  if (lockResult == null) throw createActiveTransactionError();

  const txKey = transactionKey(transaction.state);
  const ownerKey = transactionOwnerKey(transaction.state);
  try {
    await client.set(ownerKey, lockKey, { ex: TTL_SECONDS });
    await client.set(txKey, JSON.stringify(payload), { ex: TTL_SECONDS });
  } catch (error) {
    await client.del(ownerKey);
    await releaseOwnerLockKeyIfOwned(lockKey, transaction.state, client);
    throw error;
  }
}

async function saveCieOidcTransaction(userId, transaction, client = redisCache.getClient()) {
  if (!client) throw new Error('Redis richiesto per il flusso OIDC CIE reale');
  if (!userId) throw new Error('userId obbligatorio');

  const payload = {
    flow: 'identity',
    userId: String(userId),
    state: transaction.state,
    nonce: transaction.nonce,
    codeVerifier: transaction.codeVerifier,
    expiresAt: transaction.expiresAt
  };

  await saveTransactionWithOwnerLock(userLockKey(userId), payload, transaction, client);
}

async function saveCieRegistrationTransaction(
  registrationKey,
  registration,
  transaction,
  client = redisCache.getClient()
) {
  if (!client) throw new Error('Redis richiesto per il flusso OIDC CIE reale');
  if (!registrationKey) throw new Error('registrationKey obbligatorio');
  if (!registration || typeof registration !== 'object') {
    throw new Error('Registrazione OAuth mancante');
  }

  const payload = {
    flow: 'registration',
    registration,
    state: transaction.state,
    nonce: transaction.nonce,
    codeVerifier: transaction.codeVerifier,
    expiresAt: transaction.expiresAt
  };

  await saveTransactionWithOwnerLock(
    registrationLockKey(registrationKey),
    payload,
    transaction,
    client
  );
}

async function consumeCieOidcTransaction(state, client = redisCache.getClient()) {
  if (!client) throw new Error('Redis richiesto per il flusso OIDC CIE reale');

  const key = transactionKey(state);
  const ownerKey = transactionOwnerKey(state);
  const raw = await getAndDelete(client, key);
  const ownerLockKey = await getAndDelete(client, ownerKey);
  let transaction;

  try {
    if (raw == null) {
      throw new Error('Transazione CIE non trovata, scaduta o gia utilizzata');
    }

    transaction = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (transaction.state !== state) throw new Error('State CIE non valido');
    if (!transaction.expiresAt || transaction.expiresAt < Date.now()) {
      throw new Error('Transazione CIE scaduta');
    }
    return transaction;
  } finally {
    if (isValidOwnerLockKey(ownerLockKey)) {
      await releaseOwnerLockKeyIfOwned(ownerLockKey, state, client);
    } else if (transaction?.userId) {
      // Compatibility with transactions created before the owner-key mapping existed.
      await releaseUserLockIfOwned(transaction.userId, state, client);
    }
  }
}

module.exports = {
  TTL_SECONDS,
  saveCieOidcTransaction,
  saveCieRegistrationTransaction,
  consumeCieOidcTransaction
};
