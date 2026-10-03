const {
  validateRelayBatch
} = require('./researchRevocationRelayBoundary');
const {
  applyRevocationCapability
} = require('./researchDurableRevocationService');

const acceptRevocationRelayBatchDurably = async (
  client,
  batch,
  { minimumBatchSize = 8 } = {}
) => {
  if (!client || typeof client.query !== 'function') {
    throw new Error('Research durable revocation batch requires PostgreSQL client');
  }

  const validated = validateRelayBatch(batch, minimumBatchSize);

  await client.query('BEGIN');
  try {
    await client.query('SET LOCAL synchronous_commit = on');

    for (const item of validated.items) {
      const applied = await applyRevocationCapability(client, item.capability);
      if (!applied) {
        await client.query('ROLLBACK');
        return { accepted: false, durable: false };
      }
    }

    await client.query('COMMIT');
    return { accepted: true, durable: true };
  } catch (error) {
    try {
      await client.query('ROLLBACK');
    } catch {
      // Preserve the original error and never acknowledge a non-committed batch.
    }
    throw error;
  }
};

module.exports = { acceptRevocationRelayBatchDurably };
