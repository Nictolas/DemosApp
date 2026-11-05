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
  let beginAttempted = false;
  try {
    // A failed BEGIN acknowledgement might still have opened a transaction
    // server-side. Never return that connection to the pool as clean.
    beginAttempted = true;
    await db.query('BEGIN');
    began = true;
    const result = await work();
    await db.query('COMMIT');
    began = false;
    return result;
  } catch {
    if (beginAttempted && !began) {
      // The server may be in a transaction despite a client-side error.
      // No FCM or preference mutation has run yet, but the session is unsafe.
      db.__civicPreferenceTransactionUnsafe = true;
    }
    if (began) {
      // A COMMIT acknowledgement might be lost *after* PostgreSQL committed.
      // In that case ROLLBACK cannot undo the already-committed preference.
      // Persist the global push barrier regardless of that ambiguity.
      // Topic membership might also have changed on Firebase, which is never
      // part of the PostgreSQL transaction.
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
