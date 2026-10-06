const { validateCredentialContext } = require('./credentialContextPolicy');

const issueCredentialOnce = async (client, { accountId, purpose, epoch }) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Identity credential issuance requires a PostgreSQL client');
  }
  if (!accountId) {
    throw new Error('Missing credential issuance account');
  }
  validateCredentialContext({ purpose, epoch });

  await client.query('BEGIN');
  try {
    const result = await client.query(
      `INSERT INTO identity.credential_issuances (account_id, purpose, epoch)
       VALUES ($1, $2, $3)
       ON CONFLICT (account_id, purpose, epoch) DO NOTHING
       RETURNING issuance_id, issued_at`,
      [accountId, purpose, epoch]
    );
    await client.query('COMMIT');
    return result.rows[0] || null;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};

module.exports = { issueCredentialOnce };
