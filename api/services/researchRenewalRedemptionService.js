const { validateCredentialContext } = require('./credentialContextPolicy');

const redeemRenewalCredential = async (
  client,
  { credentialDigest, purpose, epoch, participantPublicKey, credentialVersion = 1 }
) => {
  if (!client || typeof client.query !== 'function') throw new Error('Research renewal redemption requires a PostgreSQL client');
  if (!credentialDigest || !participantPublicKey) throw new Error('Missing Research renewal fields');
  validateCredentialContext({ purpose, epoch });
  if (purpose !== 'renew') throw new Error('Renewal redemption requires renew purpose');
  if (!Number.isInteger(credentialVersion) || credentialVersion < 1) throw new Error('Invalid credential version');

  await client.query('BEGIN');
  try {
    const spent = await client.query(
      `INSERT INTO research.spent_credentials (credential_digest, purpose, epoch)
       VALUES ($1, $2, $3)
       ON CONFLICT (credential_digest) DO NOTHING
       RETURNING redeemed_at`,
      [credentialDigest, purpose, epoch]
    );
    if (spent.rows.length !== 1) {
      await client.query('ROLLBACK');
      return { redeemed: false, participant: null };
    }
    const participant = await client.query(
      `UPDATE research.participants
       SET last_confirmed_at = NOW(),
           expires_at = NOW() + INTERVAL '365 days',
           status = 'active',
           credential_version = GREATEST(credential_version, $2)
       WHERE participant_public_key = $1
       RETURNING participant_id, key_algorithm, credential_version, status,
                 created_at, last_confirmed_at, expires_at`,
      [participantPublicKey, credentialVersion]
    );
    if (participant.rows.length !== 1) {
      await client.query('ROLLBACK');
      return { redeemed: false, participant: null };
    }
    await client.query('COMMIT');
    return { redeemed: true, participant: participant.rows[0] };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
};
module.exports={redeemRenewalCredential};
