const { getFirebaseAdmin } = require('./firebaseAdmin');
const {
  getLegacySelectionDescriptors,
  getLegacySelectionFields,
  getLegacySelectionField,
  resolvePoliticalOffice,
} = require('./politicalJurisdictionRegistryService');
const { loadSupporterUserIds } = require('./politicalSelectionService');

const REPRESENTATIVE_FIELDS = Object.freeze(Object.fromEntries(
  getLegacySelectionDescriptors('representative').map((item) => [item.podiumLevel, item.field])
));
const CANDIDATE_FIELDS = Object.freeze(getLegacySelectionFields('candidate'));
const ALL_REPRESENTATIVE_FIELDS = Object.freeze(getLegacySelectionFields('representative'));

function resolveSelectionFields({ kind = 'representative', level = null } = {}) {
  if ((kind === 'representative' || kind === 'candidate') && level) {
    const field = getLegacySelectionField(kind, level);
    return field ? [field] : [];
  }
  if (kind === 'representative') return [...ALL_REPRESENTATIVE_FIELDS];
  if (kind === 'candidate') return [...CANDIDATE_FIELDS];
  if (kind === 'both') return [...ALL_REPRESENTATIVE_FIELDS, ...CANDIDATE_FIELDS];
  return [];
}

function normalizeTokens(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((token) => String(token || '').trim()).filter(Boolean))];
}

async function loadCurrentSupporterTokens(pool, { subjectUserId, kind, level }) {
  const officeId = level ? resolvePoliticalOffice(level)?.id || null : null;
  const canonicalKind = kind === 'both' ? null : kind;
  const supporterState = await loadSupporterUserIds(pool, {
    selectedUserId: subjectUserId,
    kind: canonicalKind,
    officeId,
  });
  if (!supporterState.userIds.length) return [];

  try {
    const result = await pool.query(
      `SELECT u.id,
              ARRAY(
                SELECT DISTINCT token
                FROM (
                  SELECT d.fcm_token AS token
                  FROM user_devices d
                  WHERE d.user_id = u.id
                    AND d.is_active = TRUE
                    AND d.fcm_token IS NOT NULL
                    AND btrim(d.fcm_token) <> ''
                  UNION
                  SELECT unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) AS token
                ) tokens
                WHERE token IS NOT NULL AND btrim(token) <> ''
              ) AS fcm_tokens
       FROM users u
       LEFT JOIN user_consents uc ON uc.user_id = u.id
       WHERE u.status = 'a'
         AND u.id::text = ANY($1::text[])
         AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE`,
      [supporterState.userIds],
    );
    return result.rows.map((row) => ({ userId: row.id, tokens: normalizeTokens(row.fcm_tokens) }));
  } catch (error) {
    if (!['42P01', '42703'].includes(error?.code)) throw error;
    const result = await pool.query(
      `SELECT u.id, COALESCE(u.fcm_tokens, ARRAY[]::text[]) AS fcm_tokens
       FROM users u
       LEFT JOIN user_consents uc ON uc.user_id = u.id
       WHERE u.status = 'a'
         AND u.id::text = ANY($1::text[])
         AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE`,
      [supporterState.userIds],
    );
    return result.rows.map((row) => ({ userId: row.id, tokens: normalizeTokens(row.fcm_tokens) }));
  }
}

async function sendPushToCurrentSupporters(pool, {
  subjectUserId,
  kind = 'representative',
  level = null,
  title,
  body,
  data = {},
}) {
  const supporters = await loadCurrentSupporterTokens(pool, { subjectUserId, kind, level });
  const admin = getFirebaseAdmin();
  const tokens = [...new Set(supporters.flatMap((row) => row.tokens))];
  if (!admin || tokens.length === 0) {
    return { targetedUsers: supporters.length, tokens: tokens.length, sent: 0, failed: 0, firebaseAvailable: Boolean(admin) };
  }

  const safeData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value == null ? '' : String(value)]),
  );
  let sent = 0;
  let failed = 0;
  for (const token of tokens) {
    try {
      await admin.messaging().send({
        token,
        notification: { title: String(title || 'DEMOS'), body: String(body || '') },
        data: safeData,
        webpush: { fcmOptions: { link: safeData.link || 'https://www.demos.community/notifiche' } },
      });
      sent += 1;
    } catch (error) {
      failed += 1;
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Push sostenitore corrente non inviato:', error?.code || error?.message);
      }
    }
  }

  return { targetedUsers: supporters.length, tokens: tokens.length, sent, failed, firebaseAvailable: true };
}

module.exports = {
  REPRESENTATIVE_FIELDS,
  CANDIDATE_FIELDS,
  resolveSelectionFields,
  loadCurrentSupporterTokens,
  sendPushToCurrentSupporters,
};
