const {
  webAuthnCredentialIdLookupVariants,
} = require('./webauthnCredentialIdPolicy');

async function ensureWebAuthnCredentialAvailable(client, credentialId) {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Client database richiesto');
  }

  const variants = webAuthnCredentialIdLookupVariants(credentialId);

  // Serializza registrazioni concorrenti dello stesso credential ID.
  // Una collisione hash può al massimo serializzare credenziali diverse: non
  // compromette la correttezza.
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtext($1))',
    [credentialId],
  );

  const existing = await client.query(
    `SELECT id
     FROM users
     WHERE webauthn_credential_id = ANY($1::text[])
     LIMIT 1`,
    [variants],
  );

  return existing.rows.length === 0;
}

module.exports = {
  ensureWebAuthnCredentialAvailable,
};
