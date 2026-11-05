'use strict';

// This wraps the *already session-locked* authenticated preference callback.
// Firebase topic changes are external and cannot be rolled back. If any part
// fails, roll back the DB preference write and persist the global delivery
// guard after ROLLBACK, outside the reverted transaction. No implicit GO.
const { blockCivicDeliveryOnRevocationFailure } = require('./civicPushDeliveryGuard');

async function runCivicPreferenceSaveAtomic(db, work, {
  enabled = false,
  block = blockCivicDeliveryOnRevocationFailure,
} = {}) {
  if (typeof work !== 'function') throw new TypeError('CIVIC_PREFERENCE_WORK_REQUIRED');
  // Preserve zero-extra-DB-work and no-topic-effects when civic push is OFF.
  if (!enabled) return work();
  if (!db || typeof db.query !== 'function') {
    throw new TypeError('CIVIC_PREFERENCE_CLIENT_REQUIRED');
  }
  let began = false;
  try {
    await db.query('BEGIN');
    began = true;
    const result = await work();
    await db.query('COMMIT');
    began = false;
    return result;
  } catch {
    if (began) {
      // Topic membership might already have changed, even if the SQL write
      // must be undone. A guard update *inside* the rollback would be lost.
      let rollbackConfirmed = false;
      try {
        await db.query('ROLLBACK');
        rollbackConfirmed = true;
      } catch {
        // Never allow an uncertain pooled connection to be reused.
        db.__civicPreferenceTransactionUnsafe = true;
      }
      if (rollbackConfirmed) {
        try {
          await block(db);
        } catch {
          // A failed guard write cannot be counted as a safe recovery.
          db.__civicPreferenceTransactionUnsafe = true;
        }
      }
    }
    // Do not expose database exceptions, user preferences, or FCM tokens.
    throw new Error('CIVIC_PREFERENCE_SAVE_UNCONFIRMED');
  }
}

module.exports = { runCivicPreferenceSaveAtomic };
