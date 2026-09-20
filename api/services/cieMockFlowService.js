const { createCieOidcTransaction, verifyState, verifyNonce } = require('./cieOidcTransactionService');

const TTL_MS = 5 * 60 * 1000;
const transactions = new Map();

function isMockCieEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.USE_MOCK_CIE === 'true';
}

function assertMockCieEnabled() {
  if (!isMockCieEnabled()) {
    const error = new Error('Mock CIE non disponibile');
    error.code = 'MOCK_CIE_DISABLED';
    throw error;
  }
}

function startMockTransaction(userId, now = Date.now()) {
  assertMockCieEnabled();

  if (!userId) throw new Error('userId obbligatorio');

  const tx = createCieOidcTransaction();
  transactions.set(tx.state, {
    userId: String(userId),
    state: tx.state,
    nonce: tx.nonce,
    codeVerifier: tx.codeVerifier,
    expiresAt: now + TTL_MS
  });

  return {
    state: tx.state,
    nonce: tx.nonce
  };
}

function consumeMockTransaction({ userId, state, nonce }, now = Date.now()) {
  assertMockCieEnabled();

  const tx = transactions.get(state);
  if (!tx) {
    throw new Error('Transazione CIE mock non trovata o gia utilizzata');
  }

  // One-time use anche in caso di errore.
  transactions.delete(state);

  if (tx.expiresAt < now) {
    throw new Error('Transazione CIE mock scaduta');
  }

  if (tx.userId !== String(userId)) {
    throw new Error('Transazione CIE mock non associata a questo account');
  }

  if (!verifyState(tx.state, state) || !verifyNonce(tx.nonce, nonce)) {
    throw new Error('State o nonce CIE mock non validi');
  }

  return {
    userId: tx.userId,
    codeVerifier: tx.codeVerifier
  };
}

function getMockCieStartErrorResponse(error) {
  if (error?.code === 'ACCOUNT_ALREADY_VERIFIED') {
    return {
      status: 409,
      error: 'Account gia associato a una identita verificata'
    };
  }

  return {
    status: 400,
    error: 'Impossibile avviare la verifica CIE mock'
  };
}

function getMockCieCompleteErrorResponse(error) {
  const safeConflicts = {
    PERSON_ALREADY_LINKED: 'Identita gia associata a un altro account DEMOS',
    ACCOUNT_ALREADY_VERIFIED: 'Account gia associato a una identita verificata',
    IDENTITY_CONFLICT: 'Conflitto durante la verifica identita'
  };

  const safeMessage = safeConflicts[error?.code];
  if (safeMessage) {
    return {
      status: 409,
      error: safeMessage
    };
  }

  return {
    status: 400,
    error: 'Verifica CIE mock non riuscita'
  };
}

function clearMockTransactionsForTests() {
  transactions.clear();
}

module.exports = {
  TTL_MS,
  isMockCieEnabled,
  startMockTransaction,
  consumeMockTransaction,
  getMockCieStartErrorResponse,
  getMockCieCompleteErrorResponse,
  clearMockTransactionsForTests
};
