'use strict';

// MANUAL emergency procedure. Default invocation is a read-only preview:
//   node api/scripts/civicPushEmergencyStop.js
// To apply after explicit authorization: CIVIC_PUSH_ROLLBACK_APPLY=true and
// CIVIC_PUSH_ROLLBACK_CONFIRM=I_APPROVE_CIVIC_EMERGENCY_STOP
// No Firebase calls, migration, deploy or automatic restart happen here.
const { getPool, closePool } = require('../config/database');
const { stopCivicPush } = require('../services/civicPushRollback');

async function main() {
  const apply = process.env.CIVIC_PUSH_ROLLBACK_APPLY === 'true';
  const confirmed = process.env.CIVIC_PUSH_ROLLBACK_CONFIRM ===
    'I_APPROVE_CIVIC_EMERGENCY_STOP';
  if (apply && !confirmed) throw new Error('CIVIC_ROLLBACK_CONFIRMATION_REQUIRED');

  const outcome = await stopCivicPush(getPool(), { apply, confirmed });
  // Counts and global state only, no identifiers, events or tokens.
  console.log('CIVIC_PUSH_ROLLBACK_SUMMARY', JSON.stringify(outcome));
}

if (require.main === module) {
  main()
    .catch(() => {
      console.error('CIVIC_PUSH_ROLLBACK_UNAVAILABLE');
      process.exitCode = 1;
    })
    .finally(() => closePool().catch(() => {}));
}

module.exports = { main };
