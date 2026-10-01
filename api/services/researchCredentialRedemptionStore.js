const consumeCredentialOnce = async (client, { credentialDigest, purpose, epoch }) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research credential redemption requires a PostgreSQL client');
  }
  if (!credentialDigest || !purpose || !epoch) {
    throw new Error('Missing credential redemption fields');
  }

  const result = await client.query(
    `INSERT INTO research.spent_credentials (credential_digest, purpose, epoch)
     VALUES ($1, $2, $3)
     ON CONFLICT (credential_digest) DO NOTHING
     RETURNING redeemed_at`,
    [credentialDigest, purpose, epoch]
  );

  return result.rows.length === 1;
};

module.exports = { consumeCredentialOnce };
