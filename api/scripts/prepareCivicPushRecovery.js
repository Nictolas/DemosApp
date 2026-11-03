'use strict';

// Manual, read-only by default. Never changes guard.blocked to FALSE.
// Preview:
//   node api/scripts/prepareCivicPushRecovery.js
//
// Preparation after explicit human approval (still NO notifications):
//   CIVIC_RECOVERY_PREPARE_APPLY=true
//   CIVIC_RECOVERY_PREPARE_CONFIRM=I_APPROVE_BLOCKED_RECOVERY_HOLD
//   node api/scripts/prepareCivicPushRecovery.js
//
// A separate staged/privacy-reviewed release is needed before unblocking.
const { getPool, closePool } = require('../config/database');
const { prepareCivicPushRecovery } = require('../services/civicPushRecovery');

async function main() {
  const apply = process.env.CIVIC_RECOVERY_PREPARE_APPLY === 'true';
  const confirmed = process.env.CIVIC_RECOVERY_PREPARE_CONFIRM ===
    'I_APPROVE_BLOCKED_RECOVERY_HOLD';
  if (apply && !confirmed) throw new Error('CIVIC_RECOVERY_CONFIRMATION_REQUIRED');

  const result = await prepareCivicPushRecovery(getPool(), { apply, confirmed });
  console.log('CIVIC_PUSH_RECOVERY_PREFLIGHT', JSON.stringify(result));
  // No automatic send, topic subscriptions, migration or guard release.
}

if (require.main === module) {
  main()
    .catch(() => {
      console.error('CIVIC_PUSH_RECOVERY_UNAVAILABLE');
      process.exitCode = 1;
    })
    .finally(() => closePool().catch(() => {}));
}
module.exports = { main };
