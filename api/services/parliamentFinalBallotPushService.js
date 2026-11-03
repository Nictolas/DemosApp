'use strict';

// Explicitly disabled until privacy, cost-zero, and Android release gates pass.
// Sends an at-most-once, best-effort push only after a newly verified latest vote
// has been committed. In-app notifications do not depend on this transport.
const { getFirebaseAdmin } = require('./firebaseAdmin');

const BATCH = 250;
const MAX_RECIPIENTS = 5000; // safety gate; scale delivery separately before broad rollout

function resolvePushTarget(chamber) {
  if (chamber === 'Camera') return { office: 'it.camera', preference: 'deputato' };
  if (chamber === 'Senato') return { office: 'it.senato', preference: 'senatore' };
  return null;
}

async function sendFinalBallotPush(pool, { representativeId, chamber, openpolisId, title, status }, options = {}) {
  if (process.env.PARLIAMENT_FINAL_PUSH_ENABLED !== 'true') {
    return { enabled: false, sent: 0, failed: 0 };
  }
  const target = resolvePushTarget(chamber);
  if (!target || !/^(vs19_\d+_\d+|19-\d+-\d+)$/.test(String(openpolisId || ''))) {
    throw new Error('PARLIAMENT_PUSH_INVALID_TARGET');
  }
  const admin = options.firebaseAdmin || getFirebaseAdmin();
  if (!admin) return { enabled: true, sent: 0, failed: 0, available: false };
  // Current canonical selection and category opt-in checked at dispatch time.
  const sql = ('SELECT DISTINCT d.fcm_token FROM users u ' +
    'JOIN political_selections ps ON ps.user_id = u.id ' +
    'JOIN notifiche_preferenze p ON p.user_id = u.id ' +
    'JOIN user_devices d ON d.user_id = u.id AND d.is_active = TRUE ' +
    "WHERE ps.selected_user_id = $1::uuid AND ps.selection_kind = 'representative' " +
    'AND ps.political_office_id = $2 ' +
    "AND lower(coalesce(u.status, '')) = 'a' " +
    'AND p.__PREF__ IS TRUE AND d.fcm_token IS NOT NULL ' +
    'AND length(btrim(d.fcm_token)) > 100 ORDER BY d.fcm_token LIMIT $3')
    .replace('__PREF__', target.preference);
  const { rows } = await pool.query(sql, [String(representativeId), target.office, MAX_RECIPIENTS + 1]);
  if (rows.length > MAX_RECIPIENTS) {
    // Do not partly deliver if the volume exceeds reviewed free-tier capacity.
    return { enabled: true, sent: 0, failed: 0, capacityGate: true };
  }
  const url = 'https://www.demos.community/notifiche?final_vote=' + encodeURIComponent(openpolisId);
  const data = {
    type: 'parliament_final_vote',
    openpolis_id: String(openpolisId),
    link: url,
    url: '/notifiche?final_vote=' + encodeURIComponent(openpolisId)
  };
  const notifTitle = chamber === 'Camera' ? 'Il tuo deputato: nuova votazione finale' :
    'Il tuo senatore: nuova votazione finale';
  // Lock-screen previews must NEVER reveal a politician's vote, status or
  // the outcome/topic before the user opens the verified in-app detail.
  const body = 'Una nuova votazione finale è disponibile. Apri DEMOS per i dettagli.';
  const messaging = admin.messaging();
  let sent = 0, failed = 0;
  // A device/token can be disabled or reassigned after initial candidate
  // discovery. Re-check it in a PostgreSQL transaction before EVERY batch.
  // FOR SHARE serializes preference, selection, user status and device writes:
  // a revocation committed before this check is respected; a concurrent
  // revocation waits for a message already being accepted by Firebase.
  // A Firebase-accepted push cannot be recalled from a device queue.
  if (!pool || typeof pool.connect !== 'function') {
    throw new Error('PARLIAMENT_PUSH_TX_POOL_REQUIRED');
  }
  const lockedSql = ('SELECT d.fcm_token FROM users u ' +
    'JOIN political_selections ps ON ps.user_id = u.id ' +
    'JOIN notifiche_preferenze p ON p.user_id = u.id ' +
    'JOIN user_devices d ON d.user_id = u.id AND d.is_active = TRUE ' +
    "WHERE ps.selected_user_id = $1::uuid AND ps.selection_kind = 'representative' " +
    'AND ps.political_office_id = $2 ' +
    "AND lower(coalesce(u.status, '')) = 'a' " +
    'AND p.__PREF__ IS TRUE AND d.fcm_token = ANY($3::text[]) ' +
    'AND length(btrim(d.fcm_token)) > 100 ' +
    'FOR SHARE OF u, ps, p, d').replace('__PREF__', target.preference);
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH).map(row => row.fcm_token);
    const client = await pool.connect();
    let began = false;
    try {
      await client.query('BEGIN');
      began = true;
      const eligible = await client.query(lockedSql, [String(representativeId), target.office, batch]);
      const allowed = new Set(batch);
      const tokens = [...new Set(eligible.rows.map(row => row.fcm_token).filter(token => allowed.has(token)))];
      const messages = tokens.map(token => ({
        token,
        notification: { title: notifTitle, body },
        data,
        android: { notification: { channelId: 'demos_notifications' } },
        webpush: { fcmOptions: { link: url } }
      }));
      if (messages.length) {
        if (typeof messaging.sendEach === 'function') {
          const result = await messaging.sendEach(messages);
          sent += Number(result.successCount) || 0;
          failed += Number(result.failureCount) || 0;
        } else {
          for (const message of messages) {
            try { await messaging.send(message); sent++; } catch { failed++; }
          }
        }
      }
      await client.query('COMMIT');
      began = false;
    } catch (error) {
      if (began) {
        try { await client.query('ROLLBACK'); } catch { /* drop failed session */ }
      }
      // Fail closed. Do not report this batch as delivered on an uncertain DB
      // lock/recheck; Firebase may have accepted a preceding batch.
      throw error;
    } finally {
      client.release();
    }
  }
  return { enabled: true, sent, failed };
}

module.exports = { resolvePushTarget, sendFinalBallotPush, MAX_RECIPIENTS };
