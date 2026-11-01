'use strict';

const { getFirebaseAdmin } = require('./firebaseAdmin');
const { CIVIC_TOPIC_BY_CATEGORY, isCivicPushEnabled } = require('./civicPushTopics');

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
    webpush: { fcmOptions: { link: publicUrl } },
  };
}

async function dispatchCivicNewInitiatives(pool, {
  enabled = isCivicPushEnabled(),
  messaging = null,
  limit = 3,
} = {}) {
  if (!enabled) return { enabled: false, accepted: 0, failed: 0 };
  if (!pool || typeof pool.query !== 'function') throw new TypeError('CIVIC_POOL_REQUIRED');
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 10) throw new RangeError('CIVIC_BATCH_LIMIT');

  // Verify Firebase before claiming a row. Never require or log provider secrets.
  const client = messaging || getFirebaseAdmin()?.messaging();
  if (!client || typeof client.send !== 'function') throw new Error('CIVIC_FIREBASE_UNAVAILABLE');

  let accepted = 0;
  let failed = 0;
  for (let index = 0; index < limit; index++) {
    const event = await claimPendingEvent(pool);
    if (!event) break;
    try {
      const payload = buildCivicPush(event);
      await client.send(payload);
      // "sent" means accepted by FCM, not delivery to every subscriber.
      await pool.query(
        `UPDATE civic_new_initiative_notifications
         SET status = 'sent', sent_at = NOW(), last_error_code = NULL
         WHERE id = $1 AND status = 'dispatching'`,
        [event.id]
      );
      accepted++;
    } catch (error) {
      // Do not automatically retry: a provider timeout might have delivered.
      // Only record a safe diagnostic code. Do not log titles or FCM error objects.
      const code = error?.message === 'CIVIC_UNSUPPORTED_CATEGORY'
        ? 'CIVIC_UNSUPPORTED_CATEGORY' : 'FCM_DELIVERY_UNCERTAIN';
      await pool.query(
        `UPDATE civic_new_initiative_notifications
         SET status = 'failed', last_error_code = $2
         WHERE id = $1 AND status = 'dispatching'`,
        [event.id, code]
      );
      failed++;
    }
  }
  return { enabled: true, accepted, failed };
}

module.exports = {
  DESTINATION_BY_CATEGORY,
  claimPendingEvent,
  buildCivicPush,
  dispatchCivicNewInitiatives,
};
