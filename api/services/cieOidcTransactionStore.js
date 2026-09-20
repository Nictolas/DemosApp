const crypto = require('crypto');
const redisCache = require('./redisCache');
const { IDENTITY_ERROR_CODES } = require('../constants/identityVerification');

const TTL_SECONDS = 5 * 60;

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

function transactionLockValue(state) {
  return hashValue(state);
}

function createActiveTransactionError() {
  const error = new Error('Verifica CIE gia in corso');
  error.code = IDENTITY_ERROR_CODES.CIE_TRANSACTION_ALREADY_ACTIVE;
  return error;
}

async function releaseUserLockIfOwned(userId, state, client) {
  const key = userLockKey(userId);
  const expected = transactionLockValue(state);
  const current = await client.get(key);

  if (current === expected) {
    await client.del(key);
  }
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

  try {
    await client.set(transactionKey(transaction.state), JSON.stringify(payload), {
      ex: TTL_SECONDS
    });
  } catch (error) {
    await releaseUserLockIfOwned(userId, transaction.state, client);
    throw error;
  }
}

async function consumeCieOidcTransaction(state, client = redisCache.getClient()) {
  if (!client) {
    throw new Error('Redis richiesto per il flusso OIDC CIE reale');
  }

  const key = transactionKey(state);
  let raw;

  if (typeof client.getdel === 'function') {
    raw = await client.getdel(key);
  } else {
    raw = await client.get(key);
    if (raw != null) await client.del(key);
  }

  if (raw == null) {
    throw new Error('Transazione CIE non trovata, scaduta o gia utilizzata');
  }

  const transaction = typeof raw === 'string' ? JSON.parse(raw) : raw;

  if (transaction.state !== state) {
    throw new Error('State CIE non valido');
  }

  if (!transaction.expiresAt || transaction.expiresAt < Date.now()) {
    await releaseUserLockIfOwned(transaction.userId, transaction.state, client);
    throw new Error('Transazione CIE scaduta');
  }

  await releaseUserLockIfOwned(transaction.userId, transaction.state, client);
  return transaction;
}

module.exports = {
  TTL_SECONDS,
  saveCieOidcTransaction,
  consumeCieOidcTransaction
};
