const { validateRelayItem } = require('./researchRevocationRelayBoundary');
const { digestRevocationCapability } = require('./researchRevocationCapabilityService');

const acceptRevocationRelayItemDurably = async (client, item) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research durable revocation requires PostgreSQL client');
  }

  const { capability } = validateRelayItem(item);
  const capabilityDigest = digestRevocationCapability(capability);

  await client.query('BEGIN');
  try {
    // A durable acknowledgement is emitted only after PostgreSQL confirms a
    // synchronous commit of the terminal Research-side revocation state.
    await client.query('SET LOCAL synchronous_commit = on');
    const result = await client.query(
      `UPDATE research.participants
       SET status = 'revoked',
           expires_at = LEAST(expires_at, NOW())
       WHERE revocation_capability_digest = $1
       RETURNING status`,
      [capabilityDigest]
    );

    if (result.rows.length !== 1) {
      await client.query('ROLLBACK');
      return { accepted: false, durable: false };
    }

    await client.query('COMMIT');
    return { accepted: true, durable: true };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original database error. No durable acknowledgement is returned.
    }
    throw error;
  }
};

module.exports = { acceptRevocationRelayItemDurably };
