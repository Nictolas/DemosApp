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
                  FROM public.user_devices d
                  WHERE d.user_id = u.id
                    AND d.is_active = TRUE
                    AND d.fcm_token IS NOT NULL
                    AND btrim(d.fcm_token) <> ''
                  UNION
                  SELECT legacy.token
                  FROM unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) AS legacy(token)
                  WHERE legacy.token IS NOT NULL
                    AND btrim(legacy.token) <> ''
                    -- A canonical device record (even inactive or owned by
                    -- another account) overrides any stale legacy copy.
                    AND CASE
                      -- Most registrations store the exact FCM token. Probe
                      -- the existing unique fcm_token index first, but never
                      -- trust a miss: older rows may contain outer spaces.
                      WHEN EXISTS (
                        SELECT 1 FROM public.user_devices registered
                        WHERE registered.fcm_token = btrim(legacy.token)
                      ) THEN FALSE
                      ELSE NOT EXISTS (
                        SELECT 1 FROM public.user_devices registered
                        WHERE btrim(registered.fcm_token) = btrim(legacy.token)
                      )
                    END
                ) tokens
                WHERE token IS NOT NULL AND btrim(token) <> ''
              ) AS fcm_tokens
       FROM public.users u
       LEFT JOIN public.user_consents uc ON uc.user_id = u.id
       WHERE u.status = 'a'
         AND u.id = ANY($1::uuid[])
         AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE`,
      [supporterState.userIds],
    );
    return result.rows.map((row) => ({ userId: row.id, tokens: normalizeTokens(row.fcm_tokens) }));
  } catch (error) {
    if (!['42P01', '42703'].includes(error?.code)) throw error;
    const result = await pool.query(
      `SELECT u.id, COALESCE(u.fcm_tokens, ARRAY[]::text[]) AS fcm_tokens
       FROM public.users u
       LEFT JOIN public.user_consents uc ON uc.user_id = u.id
       WHERE u.status = 'a'
         AND u.id = ANY($1::uuid[])
         AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE`,
      [supporterState.userIds],
    );
    return result.rows.map((row) => ({ userId: row.id, tokens: normalizeTokens(row.fcm_tokens) }));
  }
}

// Compare user UUID values natively so public.users_pkey can be used even
// when there are many registered users. The IDs come from the canonical
// political supporter lookup (public.users.id), which is UUID typed.
// A narrow, read-only consent/token check immediately before each external
// send. It deliberately does not hold a database transaction or row lock
// across Firebase I/O: that would block user revocation on remote latency.
async function isCurrentSupporterTokenEligible(pool, { userIds, token }) {
  const ids = [...new Set((userIds || []).map((id) => String(id || '').trim()).filter(Boolean))];
  const currentToken = String(token || '').trim();
  if (!ids.length || !currentToken) return false;

  const consentFilter = `FROM public.users u
     LEFT JOIN public.user_consents uc ON uc.user_id = u.id
     WHERE u.id = ANY($1::uuid[])
       AND u.status = 'a'
       AND COALESCE(uc.political_opinions_consent, u.political_opinions_consent, false) IS TRUE`;
  const legacyToken = `EXISTS (
           SELECT 1 FROM unnest(COALESCE(u.fcm_tokens, ARRAY[]::text[])) legacy(token)
           WHERE btrim(legacy.token) = $2
         )`;
  // A token registered anywhere in the canonical device registry must
  // never become eligible via an older users.fcm_tokens array. This
  // includes an inactive device and a device transferred to another user.
  // Only tokens with NO device row may use the compatibility fallback.
  const unregisteredLegacyToken = `(
         ${legacyToken}
         AND CASE
           WHEN EXISTS (
             SELECT 1 FROM public.user_devices registered
             WHERE registered.fcm_token = $2
           ) THEN FALSE
           ELSE NOT EXISTS (
             SELECT 1 FROM public.user_devices registered
             WHERE btrim(registered.fcm_token) = $2
           )
         END
       )`;
  const primary = `SELECT EXISTS (
     SELECT 1
     ${consentFilter}
       AND (
         ${unregisteredLegacyToken}
         OR EXISTS (
           SELECT 1 FROM public.user_devices d
           WHERE d.user_id = u.id AND d.is_active = TRUE
             AND btrim(d.fcm_token) = $2
         )
       )
   ) AS eligible`;
  try {
    const result = await pool.query(primary, [ids, currentToken]);
    return result.rows[0]?.eligible === true;
  } catch (error) {
    if (!['42P01', '42703'].includes(error?.code)) throw error;
    // Preserve legacy deployments without a devices table. Never use an
    // unqualified table or treat a database failure as valid consent.
    const fallback = `SELECT EXISTS (
       SELECT 1
       ${consentFilter}
         AND ${legacyToken}
     ) AS eligible`;
    const result = await pool.query(fallback, [ids, currentToken]);
    return result.rows[0]?.eligible === true;
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
  // Retain the identity that authorized each token so the pre-send check
  // verifies current consent and token registration for that same account.
  const ownersByToken = new Map();
  for (const row of supporters) {
    for (const token of row.tokens) {
      if (!ownersByToken.has(token)) ownersByToken.set(token, new Set());
      ownersByToken.get(token).add(String(row.userId));
    }
  }
  const tokens = [...ownersByToken.keys()];
  if (!admin || tokens.length === 0) {
    return { targetedUsers: supporters.length, tokens: tokens.length, sent: 0, failed: 0, skipped: 0, firebaseAvailable: Boolean(admin) };
  }

  const safeData = Object.fromEntries(
    Object.entries(data).map(([key, value]) => [key, value == null ? '' : String(value)]),
  );
  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const token of tokens) {
    let eligible = false;
    try {
      eligible = await isCurrentSupporterTokenEligible(pool, {
        userIds: [...ownersByToken.get(token)],
        token,
      });
    } catch (error) {
      // Fail closed: an unavailable consent source must never trigger a push.
      // Do not write recipient, token or political information to logs.
      if (process.env.NODE_ENV !== 'production') {
        console.warn('Supporter push consent recheck unavailable:', error?.code || 'database_error');
      }
    }
    if (!eligible) {
      skipped += 1;
      continue;
    }
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

  return { targetedUsers: supporters.length, tokens: tokens.length, sent, failed, skipped, firebaseAvailable: true };
}

module.exports = {
  REPRESENTATIVE_FIELDS,
  CANDIDATE_FIELDS,
  resolveSelectionFields,
  loadCurrentSupporterTokens,
  isCurrentSupporterTokenEligible,
  sendPushToCurrentSupporters,
};
