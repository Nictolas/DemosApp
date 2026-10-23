const crypto = require('crypto');
const { pool } = require('../middleware/auth');
const { getFirebaseAdmin } = require('./firebaseAdmin');

const DEFAULT_COOLDOWN_MS = 5 * 60 * 1000;
const recentAlerts = new Map();
const inFlightAlerts = new Set();

function cleanText(value, maxLength = 180) {
  return String(value || '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function isMalformedClientUriAlert(alert = {}) {
  if (alert.type !== 'UNHANDLED_API_ERROR' || alert.code !== 'URIError') return false;

  const endpoint = String(alert.endpoint || '');
  if (!endpoint) return false;

  try {
    decodeURI(endpoint);
    return false;
  } catch {
    return true;
  }
}

function buildFingerprint(alert) {
  return crypto
    .createHash('sha256')
    .update([
      alert.type || 'OPERATIONAL_ALERT',
      alert.component || 'api',
      alert.endpoint || '',
      alert.code || ''
    ].join('|'))
    .digest('hex');
}

function isSuppressed(fingerprint, now = Date.now()) {
  const cooldownMs = Math.max(
    30 * 1000,
    Number(process.env.OPERATIONAL_ALERT_COOLDOWN_MS || DEFAULT_COOLDOWN_MS)
  );
  const previous = recentAlerts.get(fingerprint);
  if (previous && now - previous < cooldownMs) return true;
  // A failed delivery must never start a cooldown.

  if (recentAlerts.size > 500) {
    const cutoff = now - cooldownMs * 2;
    for (const [key, timestamp] of recentAlerts.entries()) {
      if (timestamp < cutoff) recentAlerts.delete(key);
    }
  }
  return false;
}

function markDelivered(fingerprint) {
  recentAlerts.set(fingerprint, Date.now());
}

async function tableExists(tableName) {
  const result = await pool.query('SELECT to_regclass($1) AS table_name', [`public.${tableName}`]);
  return Boolean(result.rows[0]?.table_name);
}

async function columnExists(tableName, columnName) {
  const result = await pool.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1 AND column_name = $2
     ) AS present`,
    [tableName, columnName]
  );
  return Boolean(result.rows[0]?.present);
}

async function getAdminIds() {
  if (await columnExists('users', 'is_admin')) {
    const result = await pool.query(
      `SELECT id::text AS id FROM users WHERE COALESCE(is_admin, FALSE) = TRUE`
    );
    return result.rows.map((row) => row.id);
  }

  if (await columnExists('users', 'ruolo')) {
    const result = await pool.query(`SELECT id::text AS id FROM users WHERE ruolo = 'AD'`);
    return result.rows.map((row) => row.id);
  }

  return [];
}

async function persistAdminAlert(adminIds, title, body) {
  if (adminIds.length === 0 || !(await tableExists('notifiche_demos'))) return 0;

  const result = await pool.query(
    `INSERT INTO notifiche_demos (id, id_utente, titolo, testo, data, data_creazione)
     SELECT gen_random_uuid(), u.id, $2, $3, CURRENT_DATE, NOW()
     FROM users u
     WHERE u.id::text = ANY($1::text[])
     RETURNING id`,
    [adminIds, title, body]
  );
  return result.rowCount || 0;
}

async function getAdminDeviceTokens(adminIds) {
  if (adminIds.length === 0 || !(await tableExists('user_devices'))) return [];

  const result = await pool.query(
    `SELECT DISTINCT ON (user_id::text)
       user_id::text AS user_id, fcm_token
     FROM user_devices
     WHERE is_active = TRUE
       AND NULLIF(TRIM(fcm_token), '') IS NOT NULL
       AND user_id::text = ANY($1::text[])
     ORDER BY user_id::text, updated_at DESC NULLS LAST, last_seen_at DESC NULLS LAST`,
    [adminIds]
  );
  return result.rows;
}

async function invalidateToken(token) {
  try {
    await pool.query('DELETE FROM user_devices WHERE fcm_token = $1', [token]);
  } catch (error) {
    // FCM/SQL exception text can include credentials or device tokens.
    console.warn('OPERATIONAL_ALERT_TOKEN_INVALIDATION_FAILED');
  }
}

async function pushToAdmins(adminIds, title, body, alert) {
  const firebaseAdmin = getFirebaseAdmin();
  if (!firebaseAdmin) return { sent: 0, failed: 0, unavailable: true };

  const devices = await getAdminDeviceTokens(adminIds);
  let sent = 0;
  let failed = 0;

  for (const device of devices) {
    try {
      await firebaseAdmin.messaging().send({
        token: device.fcm_token,
        notification: { title, body },
        data: {
          type: 'operational_alert',
          severity: cleanText(alert.severity || 'CRITICAL', 20),
          component: cleanText(alert.component || 'api', 60),
          url: '/notifiche'
        },
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default' } } }
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      const code = error?.code || '';
      if (
        code.includes('registration-token-not-registered') ||
        code.includes('invalid-registration-token') ||
        code.includes('invalid-argument')
      ) {
        await invalidateToken(device.fcm_token);
      }
    }
  }

  return { sent, failed, unavailable: false };
}

class OperationalAlertService {
  static async sendCriticalAlert(alert = {}) {
    const normalized = {
      type: cleanText(alert.type || 'OPERATIONAL_ALERT', 80),
      component: cleanText(alert.component || 'api', 80),
      severity: cleanText(alert.severity || 'CRITICAL', 20),
      endpoint: cleanText(alert.endpoint || '', 160),
      code: cleanText(alert.code || '', 80)
    };

    // Scanner e bot inviano periodicamente URI con percent-encoding non valido
    // (es. /%c0). Express le segnala come URIError: sono richieste client malformate,
    // non incidenti applicativi e non devono generare notifiche CRITICAL agli Admin.
    if (isMalformedClientUriAlert(normalized)) {
      return {
        success: true,
        suppressed: true,
        reason: 'MALFORMED_CLIENT_URI',
        fingerprint: buildFingerprint(normalized)
      };
    }

    const fingerprint = buildFingerprint(normalized);
    if (isSuppressed(fingerprint)) {
      return { success: true, suppressed: true, fingerprint };
    }

    if (inFlightAlerts.has(fingerprint)) {
      // A concurrent attempt is NOT proof the first notification succeeded.
      return { success: false, suppressed: true, reason: 'IN_FLIGHT', fingerprint };
    }
    inFlightAlerts.add(fingerprint);

    const title = `DEMOS — ${normalized.severity}`;
    const endpointText = normalized.endpoint ? ` · ${normalized.endpoint}` : '';
    const body = cleanText(`${normalized.component}: ${normalized.type}${endpointText}`, 220);

    try {
      const adminIds = await getAdminIds();
      const persisted = await persistAdminAlert(adminIds, title, body);
      let push;
      try {
        push = await pushToAdmins(adminIds, title, body, normalized);
      } catch (_pushError) {
        // In-app persistence may already have succeeded; do not turn an FCM
        // outage into a false failure that creates duplicate DB notifications.
        // Do not log exception details (device tokens can be embedded).
        push = { sent: 0, failed: 0, unavailable: true };
      }
      const delivered = persisted > 0 || push.sent > 0;
      if (delivered) markDelivered(fingerprint);
      inFlightAlerts.delete(fingerprint);

      return {
        success: delivered,
        suppressed: false,
        fingerprint,
        adminRecipients: adminIds.length,
        persisted,
        push
      };
    } catch (error) {
      // Never emit provider/SQL exception text: it may contain PII or secrets.
      inFlightAlerts.delete(fingerprint);
      console.error('OPERATIONAL_ALERT_DELIVERY_FAILED');
      return {
        success: false,
        suppressed: false,
        fingerprint,
        error: 'OPERATIONAL_ALERT_DELIVERY_FAILED'
      };
    }
  }
}

module.exports = OperationalAlertService;
module.exports.__testables = {
  buildFingerprint,
  cleanText,
  isMalformedClientUriAlert,
  isSuppressed,
  recentAlerts
};
