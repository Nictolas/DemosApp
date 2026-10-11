'use strict';

const { getPool } = require('../config/database');
const redisCache = require('../services/redisCache');
const { E2E_USER_ID, E2E_ACTIVIST_USER_ID } = require('./stagingMigrate');

const TEST_SOURCE = 'STAGING_E2E_OPINION';
const TEST_OFFICE = 'e2e.opinion-notification';
const TEST_OPINION_COLUMN = 'e2e_opinion_notification_test';

async function expectJson(response, expectedStatus, label) {
  let body = null;
  try { body = await response.json(); } catch (_) {}
  if (response.status !== expectedStatus) {
    throw new Error(`${label}: expected ${expectedStatus}, got ${response.status}${body ? ` ${JSON.stringify(body)}` : ''}`);
  }
  return body;
}

async function pickOpinionColumn(db) {
  const result = await db.query(`
    SELECT c.column_name AS id
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'opinioni_risposte'
      AND c.column_name NOT IN ('id', 'user_id', 'created_at', 'updated_at', 'fonti_opinioni')
    ORDER BY c.ordinal_position
    LIMIT 1
  `);
  const existingId = result.rows[0]?.id;
  if (existingId) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(existingId)) throw new Error(`Unsafe opinion column selected: ${existingId}`);
    return { id: existingId, temporary: existingId === TEST_OPINION_COLUMN };
  }

  await db.query(`ALTER TABLE opinioni_risposte ADD COLUMN IF NOT EXISTS "${TEST_OPINION_COLUMN}" TEXT`);
  return { id: TEST_OPINION_COLUMN, temporary: true };
}

async function runStagingPoliticalOpinionNotificationSelfTest({
  env = process.env,
  port = process.env.PORT || 3001,
  fetchImpl = global.fetch,
  tokenFactory,
  pool = getPool(),
  logger = console,
} = {}) {
  if (env.DEMOS_STAGING_OPINION_NOTIFICATION_E2E !== 'true') {
    return { mode: 'disabled', passed: 0, total: 3 };
  }
  if (env.NODE_ENV !== 'staging') {
    throw new Error('DEMOS_STAGING_OPINION_NOTIFICATION_E2E is allowed only with NODE_ENV=staging');
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for staging opinion-notification E2E');
  if (!pool || typeof pool.query !== 'function') throw new Error('database pool is required for staging opinion-notification E2E');

  const makeToken = tokenFactory || ((payload) => require('../utils/jwt').generateAccessToken(payload));
  const subjectToken = makeToken({ userId: E2E_ACTIVIST_USER_ID });
  const baseUrl = `http://127.0.0.1:${port}`;
  const authHeaders = {
    Authorization: `Bearer ${subjectToken}`,
    'content-type': 'application/json',
  };

  let opinionId = null;
  let temporaryOpinionColumn = false;
  let previousConsent = null;
  let consentExisted = false;
  let consentSnapshotTaken = false;
  let responseRowExisted = false;
  let previousOpinionValue = null;
  let passed = 0;

  try {
    const selectedOpinion = await pickOpinionColumn(pool);
    opinionId = selectedOpinion.id;
    temporaryOpinionColumn = selectedOpinion.temporary;

    const consentSnapshot = await pool.query(
      `SELECT political_opinions_consent
       FROM user_consents
       WHERE user_id = $1`,
      [E2E_ACTIVIST_USER_ID],
    );
    consentSnapshotTaken = true;
    consentExisted = consentSnapshot.rows.length > 0;
    previousConsent = consentSnapshot.rows[0]?.political_opinions_consent ?? null;

    const quotedOpinion = `"${opinionId}"`;
    const answerSnapshot = await pool.query(
      `SELECT ${quotedOpinion} AS value
       FROM opinioni_risposte
       WHERE user_id = $1`,
      [E2E_ACTIVIST_USER_ID],
    );
    responseRowExisted = answerSnapshot.rows.length > 0;
    previousOpinionValue = answerSnapshot.rows[0]?.value ?? null;

    await pool.query(`DELETE FROM political_candidacies WHERE user_id = $1 AND source = $2`, [E2E_ACTIVIST_USER_ID, TEST_SOURCE]);
    await pool.query(
      `INSERT INTO political_candidacies (user_id, jurisdiction, status, source, legacy_context)
       VALUES ($1, '{"country":"IT","level":"E2E"}'::jsonb, 'ACTIVE', $2, '{"purpose":"opinion_notification_e2e"}'::jsonb)`,
      [E2E_ACTIVIST_USER_ID, TEST_SOURCE],
    );

    await pool.query(
      `INSERT INTO political_selections (
         user_id, selection_kind, jurisdiction_id, political_office_id, selected_user_id, source, context
       ) VALUES ($1, 'candidate', 'e2e', $2, $3, $4, '{"purpose":"opinion_notification_e2e"}'::jsonb)
       ON CONFLICT (user_id, selection_kind, political_office_id)
       DO UPDATE SET selected_user_id = EXCLUDED.selected_user_id,
                     jurisdiction_id = EXCLUDED.jurisdiction_id,
                     source = EXCLUDED.source,
                     context = EXCLUDED.context,
                     updated_at = NOW()`,
      [E2E_USER_ID, TEST_OFFICE, E2E_ACTIVIST_USER_ID, TEST_SOURCE],
    );

    await pool.query(
      `INSERT INTO user_consents (user_id, political_opinions_consent, political_opinions_consent_timestamp)
       VALUES ($1, TRUE, NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET political_opinions_consent = TRUE,
                     political_opinions_consent_timestamp = NOW(),
                     updated_at = NOW()`,
      [E2E_ACTIVIST_USER_ID],
    );

    if (responseRowExisted) {
      await pool.query(`UPDATE opinioni_risposte SET ${quotedOpinion} = NULL WHERE user_id = $1`, [E2E_ACTIVIST_USER_ID]);
    } else {
      await pool.query(`DELETE FROM opinioni_risposte WHERE user_id = $1`, [E2E_ACTIVIST_USER_ID]);
    }

    await pool.query(
      `DELETE FROM political_opinion_notifications
       WHERE recipient_user_id = $1 AND subject_user_id = $2 AND opinion_id = $3`,
      [E2E_USER_ID, E2E_ACTIVIST_USER_ID, opinionId],
    );
    await redisCache.invalidateAuthUserCache(E2E_ACTIVIST_USER_ID);

    let response = await fetchImpl(`${baseUrl}/api/opinioni/salva`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ opinioni: { [opinionId]: 'f' } }),
      signal: AbortSignal.timeout(8000),
    });
    let body = await expectJson(response, 200, 'first opinion response');
    if (Number(body?.notificationsCreated || 0) !== 0) {
      throw new Error(`first opinion response created ${body?.notificationsCreated} notifications`);
    }
    let countResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM political_opinion_notifications
       WHERE recipient_user_id = $1 AND subject_user_id = $2 AND opinion_id = $3`,
      [E2E_USER_ID, E2E_ACTIVIST_USER_ID, opinionId],
    );
    if (countResult.rows[0]?.count !== 0) throw new Error('first opinion response persisted a supporter notification');
    logger.log(`[staging-opinion-e2e] first response -> no notification PASS (${opinionId})`);
    passed += 1;

    response = await fetchImpl(`${baseUrl}/api/opinioni/salva`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ opinioni: { [opinionId]: 'c' } }),
      signal: AbortSignal.timeout(8000),
    });
    body = await expectJson(response, 200, 'changed opinion response');
    if (Number(body?.notificationsCreated || 0) !== 1) {
      throw new Error(`changed opinion response created ${body?.notificationsCreated} notifications instead of 1`);
    }
    const notificationResult = await pool.query(
      `SELECT previous_value, new_value
       FROM political_opinion_notifications
       WHERE recipient_user_id = $1 AND subject_user_id = $2 AND opinion_id = $3
       ORDER BY created_at DESC
       LIMIT 1`,
      [E2E_USER_ID, E2E_ACTIVIST_USER_ID, opinionId],
    );
    if (notificationResult.rows.length !== 1 || notificationResult.rows[0].previous_value !== 'f' || notificationResult.rows[0].new_value !== 'c') {
      throw new Error('changed opinion notification was not persisted for the current supporter with f -> c');
    }
    logger.log('[staging-opinion-e2e] real change -> current supporter notification PASS');
    passed += 1;

    response = await fetchImpl(`${baseUrl}/api/opinioni/salva`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ opinioni: { [opinionId]: 'c' } }),
      signal: AbortSignal.timeout(8000),
    });
    body = await expectJson(response, 200, 'unchanged opinion response');
    if (Number(body?.notificationsCreated || 0) !== 0) {
      throw new Error(`unchanged opinion response created ${body?.notificationsCreated} notifications`);
    }
    countResult = await pool.query(
      `SELECT COUNT(*)::int AS count
       FROM political_opinion_notifications
       WHERE recipient_user_id = $1 AND subject_user_id = $2 AND opinion_id = $3`,
      [E2E_USER_ID, E2E_ACTIVIST_USER_ID, opinionId],
    );
    if (countResult.rows[0]?.count !== 1) throw new Error(`unchanged opinion altered notification count to ${countResult.rows[0]?.count}`);
    logger.log('[staging-opinion-e2e] unchanged value -> no duplicate notification PASS');
    passed += 1;

    logger.log(`[staging-opinion-e2e] PASS ${passed}/3`);
    return { mode: 'opinion-notification-e2e', passed, total: 3, opinionId };
  } finally {
    try {
      if (opinionId) {
        const quotedOpinion = `"${opinionId}"`;
        await pool.query(
          `DELETE FROM political_opinion_notifications
           WHERE recipient_user_id = $1 AND subject_user_id = $2 AND opinion_id = $3`,
          [E2E_USER_ID, E2E_ACTIVIST_USER_ID, opinionId],
        );
        if (responseRowExisted) {
          await pool.query(`UPDATE opinioni_risposte SET ${quotedOpinion} = $2 WHERE user_id = $1`, [E2E_ACTIVIST_USER_ID, previousOpinionValue]);
        } else {
          await pool.query(`DELETE FROM opinioni_risposte WHERE user_id = $1`, [E2E_ACTIVIST_USER_ID]);
        }
      }
      await pool.query(
        `DELETE FROM political_selections
         WHERE user_id = $1 AND selection_kind = 'candidate' AND political_office_id = $2 AND source = $3`,
        [E2E_USER_ID, TEST_OFFICE, TEST_SOURCE],
      );
      await pool.query(`DELETE FROM political_candidacies WHERE user_id = $1 AND source = $2`, [E2E_ACTIVIST_USER_ID, TEST_SOURCE]);
      if (temporaryOpinionColumn) {
        await pool.query(`ALTER TABLE opinioni_risposte DROP COLUMN IF EXISTS "${TEST_OPINION_COLUMN}"`);
      }
      if (consentSnapshotTaken) {
        if (consentExisted) {
          await pool.query(
            `UPDATE user_consents
             SET political_opinions_consent = $2, updated_at = NOW()
             WHERE user_id = $1`,
            [E2E_ACTIVIST_USER_ID, previousConsent],
          );
        } else {
          await pool.query(`DELETE FROM user_consents WHERE user_id = $1`, [E2E_ACTIVIST_USER_ID]);
        }
      }
      await redisCache.invalidateAuthUserCache(E2E_ACTIVIST_USER_ID);
      logger.log('[staging-opinion-e2e] cleanup PASS');
    } catch (cleanupError) {
      logger.error(`[staging-opinion-e2e] cleanup FAILED: ${cleanupError.message}`);
      throw cleanupError;
    }
  }
}

module.exports = {
  TEST_SOURCE,
  TEST_OFFICE,
  TEST_OPINION_COLUMN,
  pickOpinionColumn,
  runStagingPoliticalOpinionNotificationSelfTest,
};
