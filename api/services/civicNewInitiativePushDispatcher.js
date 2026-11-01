'use strict';

const { getFirebaseAdmin } = require('./firebaseAdmin');
const { CIVIC_TOPIC_BY_CATEGORY, isCivicPushEnabled } = require('./civicPushTopics');
const {
  readCivicDeliveryBarrier,
  acquireCivicPushDeliveryLock,
  releaseCivicPushDeliveryLock,
} = require('./civicPushDeliveryGuard');

const DESTINATION_BY_CATEGORY = Object.freeze({
  iniziative_popolari: { title: 'Nuova iniziativa popolare', path: '/iniziative-popolari' },
  referendum_abrogativi: { title: 'Nuovo referendum abrogativo', path: '/referendum-abrogativi' },
  eci: { title: 'Nuova iniziativa europea', path: '/eci' },
});

/**
 * Single-row atomic claim. A sending row is NEVER automatically reclaimed:
 * if Firebase accepted a push but the process crashed before DB acknowledgement,
 * retransmission could notify everybody twice. Such rows need manual review.
 */
async function claimPendingEvent(pool) {
  const result = await pool.query(`
    UPDATE civic_new_initiative_notifications AS e
    SET status = 'dispatching', attempts = attempts + 1, last_error_code = NULL
    WHERE e.id = (
      SELECT id FROM civic_new_initiative_notifications
      WHERE status = 'pending'
      ORDER BY discovered_at, id
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING e.id, e.category, e.official_id, e.title
  `);
  return result.rows[0] || null;
}

function buildCivicPush(event) {
  const destination = DESTINATION_BY_CATEGORY[event.category];
  const topic = CIVIC_TOPIC_BY_CATEGORY[event.category];
  if (!destination || !topic) throw new Error('CIVIC_UNSUPPORTED_CATEGORY');
  const publicUrl = 'https://www.demos.community' + destination.path
    + '?initiative=' + encodeURIComponent(String(event.official_id));
  return {
    topic,
    notification: {
      title: destination.title,
      body: String(event.title || 'Consulta la nuova raccolta firme ufficiale.').slice(0, 180),
    },
    data: {
      type: 'civic_new_initiative',
      category: event.category,
      official_id: String(event.official_id),
      event_id: String(event.id),
      link: publicUrl,
    },
    // Short retention limits late delivery after an account has opted out.
    // It cannot retract messages already accepted by FCM.
    android: { ttl: 60 * 60 * 1000 },
    webpush: {
      headers: { TTL: '3600' },
      notification: { tag: 'demos-civic-' + String(event.id) },
      fcmOptions: { link: publicUrl },
    },
  };
}

async function dispatchCivicNewInitiatives(pool, {
  enabled = isCivicPushEnabled(),
  messaging = null,
  limit = 3,
} = {}) {
  if (!enabled) return { enabled: false, accepted: 0, failed: 0 };
  if (!pool || typeof pool.connect !== 'function') throw new TypeError('CIVIC_POOL_REQUIRED');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10) throw new RangeError('CIVIC_BATCH_LIMIT');

  // Same exclusive DB advisory lock as account erasure. Do not send a NEW
  // message after a deletion/failed revocation has committed.
  const client = await pool.connect();
  let locked = false;
  let lockAttempted = false;
  let discard = false;
  try {
    lockAttempted = true;
    await acquireCivicPushDeliveryLock(client);
    locked = true;
    const safety = await readCivicDeliveryBarrier(client);
    if (safety.blocked) {
      return { enabled: true, blocked: true, accepted: 0, failed: 0 };
    }

    // Check Firebase before claiming an event. Provider errors remain sanitized.
    const firebase = messaging || getFirebaseAdmin()?.messaging();
    if (!firebase || typeof firebase.send !== 'function') {
      throw new Error('CIVIC_FIREBASE_UNAVAILABLE');
    }

    let accepted = 0;
    let failed = 0;
    for (let index = 0; index < limit; index++) {
      const event = await claimPendingEvent(client);
      if (!event) break;
      try {
        const payload = buildCivicPush(event);
        await firebase.send(payload);
        // "sent" means accepted by FCM, not delivered to every device.
        await client.query(
          `UPDATE civic_new_initiative_notifications
           SET status = 'sent', sent_at = NOW(), last_error_code = NULL
           WHERE id = $1 AND status = 'dispatching'`,
          [event.id]
        );
        accepted++;
      } catch (error) {
        // Never retry an uncertain provider outcome automatically.
        const code = error?.message === 'CIVIC_UNSUPPORTED_CATEGORY'
          ? 'CIVIC_UNSUPPORTED_CATEGORY' : 'FCM_DELIVERY_UNCERTAIN';
        await client.query(
          `UPDATE civic_new_initiative_notifications
           SET status = 'failed', last_error_code = $2
           WHERE id = $1 AND status = 'dispatching'`,
          [event.id, code]
        );
        failed++;
      }
    }
    return { enabled: true, blocked: false, accepted, failed };
  } finally {
    if (locked) {
      try {
        await releaseCivicPushDeliveryLock(client);
      } catch {
        // A pooled DB session with an uncertain session lock is unsafe to reuse.
        discard = true;
      }
    } else if (lockAttempted) {
      // The lock may have been acquired before a network error. Destroy the
      // connection rather than returning a possibly locked session to the pool.
      discard = true;
    }
    client.release(discard);
  }
}

module.exports = {
  DESTINATION_BY_CATEGORY,
  claimPendingEvent,
  buildCivicPush,
  dispatchCivicNewInitiatives,
};
