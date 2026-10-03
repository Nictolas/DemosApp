const { validateCredentialContext } = require('./credentialContextPolicy');
const { digestRevocationCapability } = require('./researchRevocationCapabilityService');

const redeemEnrollmentCredential = async (
  client,
  {
    credentialDigest,
    purpose,
    epoch,
    participantPublicKey,
    revocationCapability,
    keyAlgorithm = 'ed25519',
    credentialVersion = 1
  }
) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research enrollment redemption requires a PostgreSQL client');
  }
  if (!credentialDigest || !participantPublicKey) {
    throw new Error('Missing Research enrollment fields');
  }
  validateCredentialContext({ purpose, epoch });
  if (purpose !== 'enroll') {
    throw new Error('Enrollment redemption requires enroll purpose');
  }
  if (keyAlgorithm !== 'ed25519') {
    throw new Error('Unsupported participant key algorithm');
  }
  if (!Number.isInteger(credentialVersion) || credentialVersion < 1) {
    throw new Error('Invalid credential version');
  }

  const revocationCapabilityDigest = digestRevocationCapability(revocationCapability);

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
      `INSERT INTO research.participants (
         participant_public_key, revocation_capability_digest, key_algorithm,
         credential_version, last_confirmed_at, expires_at
       )
       VALUES ($1, $2, $3, $4, NOW(), NOW() + INTERVAL '365 days')
       ON CONFLICT (participant_public_key) DO NOTHING
       RETURNING participant_id, key_algorithm, credential_version, status, created_at,
                 last_confirmed_at, expires_at`,
      [participantPublicKey, revocationCapabilityDigest, keyAlgorithm, credentialVersion]
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

module.exports = { redeemEnrollmentCredential };
