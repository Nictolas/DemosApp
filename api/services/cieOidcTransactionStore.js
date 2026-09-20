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

function hashValue(value) {
  return crypto.createHash('sha256').update(String(value), 'utf8').digest('hex');
}

function transactionKey(state) {
  if (typeof state !== 'string' || state.length < 32) {
    throw new Error('State CIE non valido');
  }

  const digest = hashValue(state);
  return `cie:oidc:tx:${digest}`;
}

function userLockKey(userId) {
  if (!userId) throw new Error('userId obbligatorio');
  return `cie:oidc:user:${hashValue(userId)}`;
}

function transactionOwnerKey(state) {
  return `cie:oidc:tx-owner:${hashValue(state)}`;
}

function isValidUserLockKey(key) {
  return typeof key === 'string' && /^cie:oidc:user:[a-f0-9]{64}$/.test(key);
}

function transactionLockValue(state) {
  return hashValue(state);
}

function createActiveTransactionError() {
  const error = new Error('Verifica CIE gia in corso');
  error.code = IDENTITY_ERROR_CODES.CIE_TRANSACTION_ALREADY_ACTIVE;
  return error;
}

async function releaseUserLockKeyIfOwned(key, state, client) {
  if (typeof client.eval !== 'function') {
    throw new Error('Redis EVAL richiesto per rilascio lock CIE');
  }
  if (!isValidUserLockKey(key)) {
    throw new Error('Chiave lock CIE non valida');
  }

  const expected = transactionLockValue(state);
  await client.eval(RELEASE_LOCK_SCRIPT, [key], [expected]);
}

async function releaseUserLockIfOwned(userId, state, client) {
  return releaseUserLockKeyIfOwned(userLockKey(userId), state, client);
}

async function getAndDelete(client, key) {
  if (typeof client.getdel === 'function') {
    return client.getdel(key);
  }

  const value = await client.get(key);
  if (value != null) await client.del(key);
  return value;
}

async function saveCieOidcTransaction(userId, transaction, client = redisCache.getClient()) {
  if (!client) {
    throw new Error('Redis richiesto per il flusso OIDC CIE reale');
  }
  if (!userId) throw new Error('userId obbligatorio');

  const payload = {
    userId: String(userId),
    state: transaction.state,
    nonce: transaction.nonce,
    codeVerifier: transaction.codeVerifier,
    expiresAt: transaction.expiresAt
  };

  const lockKey = userLockKey(userId);
  const lockValue = transactionLockValue(transaction.state);
  const lockResult = await client.set(lockKey, lockValue, {
    ex: TTL_SECONDS,
    nx: true
  });

  if (lockResult == null) {
    throw createActiveTransactionError();
  }

  const txKey = transactionKey(transaction.state);
  const ownerKey = transactionOwnerKey(transaction.state);

  try {
    await client.set(ownerKey, lockKey, {
      ex: TTL_SECONDS
    });
    await client.set(txKey, JSON.stringify(payload), {
      ex: TTL_SECONDS
    });
  } catch (error) {
    await client.del(ownerKey);
    await releaseUserLockIfOwned(userId, transaction.state, client);
    throw error;
  }
}

async function consumeCieOidcTransaction(state, client = redisCache.getClient()) {
  if (!client) {
    throw new Error('Redis richiesto per il flusso OIDC CIE reale');
  }

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

    if (transaction.state !== state) {
      throw new Error('State CIE non valido');
    }

    if (!transaction.expiresAt || transaction.expiresAt < Date.now()) {
      throw new Error('Transazione CIE scaduta');
    }

    return transaction;
  } finally {
    if (isValidUserLockKey(ownerLockKey)) {
      await releaseUserLockKeyIfOwned(ownerLockKey, state, client);
    } else if (transaction?.userId) {
      // Compatibilita con transazioni create prima dell'introduzione della chiave owner.
      await releaseUserLockIfOwned(transaction.userId, state, client);
    }
  }
}

module.exports = {
  TTL_SECONDS,
  saveCieOidcTransaction,
  consumeCieOidcTransaction
};
