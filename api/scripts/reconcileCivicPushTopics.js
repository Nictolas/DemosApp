'use strict';

// Manual rollout tool only; never scheduled and never unlocks the guard.
// Default: read-only aggregate preview, no Firebase subscriptions.
// Apply requires TWO explicit environment flags and the delivery guard must
// still be blocked in PostgreSQL. Run against authorized staging first.
const { getPool, closePool } = require('../config/database');
const { reconcileAllCivicTopics } = require('../services/civicPushTopicBootstrap');

async function main() {
  const apply = process.env.CIVIC_TOPIC_BOOTSTRAP_APPLY === 'true';
  if (apply && process.env.CIVIC_TOPIC_BOOTSTRAP_CONFIRM !== 'I_APPROVE_TOPIC_RECONCILIATION') {
    throw new Error('CIVIC_TOPIC_BOOTSTRAP_CONFIRMATION_REQUIRED');
  }

  const outcome = await reconcileAllCivicTopics(getPool(), { dryRun: !apply });
  // No tokens or user identifiers in output.
  console.log('CIVIC_TOPIC_BOOTSTRAP_SUMMARY', JSON.stringify(outcome));
}

if (require.main === module) {
  main()
    .catch(() => {
      console.error('CIVIC_TOPIC_BOOTSTRAP_FAILED');
      process.exitCode = 1;
    })
    .finally(() => closePool().catch(() => {}));
}

module.exports = { main };
