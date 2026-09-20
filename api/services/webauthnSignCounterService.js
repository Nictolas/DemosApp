const MAX_POSTGRES_INTEGER = 2147483647;

function invalidCounterError() {
  const error = new Error('Contatore WebAuthn non valido');
  error.code = 'INVALID_WEBAUTHN_SIGN_COUNTER';
  return error;
}

function normalizeWebAuthnSignCounter(value) {
  const counter = Number(value);
  if (
    !Number.isSafeInteger(counter) ||
    counter < 0 ||
    counter > MAX_POSTGRES_INTEGER
  ) {
    throw invalidCounterError();
  }
  return counter;
}

async function advanceWebAuthnSignCounter(db, userId, newCounter) {
  if (!db || typeof db.query !== 'function') {
    throw new Error('Database richiesto per aggiornare il contatore WebAuthn');
  }
  if (!userId) {
    throw new Error('userId richiesto per aggiornare il contatore WebAuthn');
  }

  const counter = normalizeWebAuthnSignCounter(newCounter);

  const result = counter === 0
    ? await db.query(
        `UPDATE users
         SET webauthn_sign_count = 0,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1
           AND COALESCE(webauthn_sign_count, 0) = 0
         RETURNING webauthn_sign_count`,
        [userId],
      )
    : await db.query(
        `UPDATE users
         SET webauthn_sign_count = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2
           AND COALESCE(webauthn_sign_count, 0) < $1
         RETURNING webauthn_sign_count`,
        [counter, userId],
      );

  return result.rows.length === 1;
}

module.exports = {
  normalizeWebAuthnSignCounter,
  advanceWebAuthnSignCounter
};
