const crypto = require('crypto');
const redisCache = require('./redisCache');

const TTL_SECONDS = 5 * 60;

function transactionKey(state) {
  if (typeof state !== 'string' || state.length < 32) {
    throw new Error('State CIE non valido');
  }

  const digest = crypto.createHash('sha256').update(state, 'utf8').digest('hex');
  return `cie:oidc:tx:${digest}`;
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

  await client.set(transactionKey(transaction.state), JSON.stringify(payload), {
    ex: TTL_SECONDS
  });
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
    throw new Error('Transazione CIE scaduta');
  }

  return transaction;
}

module.exports = {
  TTL_SECONDS,
  saveCieOidcTransaction,
  consumeCieOidcTransaction
};
