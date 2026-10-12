'use strict';

const { getPool } = require('../config/database');
const PrivacyErasureLedgerService = require('../services/privacyErasureLedgerService');

const CONSENT_E2E_USER_ID = '00000000-0000-4000-8000-000000000009';

async function expectJson(response, expectedStatus, label) {
  let body = null;
  try { body = await response.json(); } catch (_) {}
  if (response.status !== expectedStatus) {
    throw new Error(`${label}: expected ${expectedStatus}, got ${response.status}${body ? ` ${JSON.stringify(body)}` : ''}`);
  }
  return body;
}

async function cleanup(pool) {
  await PrivacyErasureLedgerService.ensureTable(pool);
  await pool.query('DELETE FROM privacy_erasure_ledger WHERE subject_user_id = $1', [CONSENT_E2E_USER_ID]);
  await pool.query('DELETE FROM users WHERE id = $1', [CONSENT_E2E_USER_ID]);
}

async function createSyntheticUser(pool) {
  await pool.query(
    `INSERT INTO users (
       id, name, nome, cognome, ruolo, status, account_type, is_admin, is_activist,
       privacy_policy_consent, terms_of_service_consent, political_opinions_consent
     ) VALUES ($1, $2, 'DEMOS', 'Consent E2E', 'E', 'a', 'PERSON', FALSE, FALSE, TRUE, TRUE, FALSE)`,
    [CONSENT_E2E_USER_ID, 'DEMOS Political Consent E2E']
  );
  await pool.query(
    `INSERT INTO user_consents (
       user_id, privacy_policy_consent, terms_of_service_consent,
       consent_timestamp, political_opinions_consent
     ) VALUES ($1, TRUE, TRUE, NOW(), FALSE)`,
    [CONSENT_E2E_USER_ID]
  );
}

async function setPoliticalConsent(pool, granted) {
  await pool.query(
    `UPDATE users
        SET political_opinions_consent = $2,
            political_opinions_consent_timestamp = CASE WHEN $2 THEN NOW() ELSE NULL END,
            updated_at = NOW()
      WHERE id = $1`,
    [CONSENT_E2E_USER_ID, granted]
  );
  await pool.query(
    `UPDATE user_consents
        SET political_opinions_consent = $2,
            political_opinions_consent_timestamp = CASE WHEN $2 THEN NOW() ELSE NULL END,
            updated_at = NOW()
      WHERE user_id = $1`,
    [CONSENT_E2E_USER_ID, granted]
  );
}

async function readFinalState(pool) {
  const consent = await pool.query(
    `SELECT
       u.political_opinions_consent AS legacy_consent,
       uc.political_opinions_consent AS normalized_consent
     FROM users u
     JOIN user_consents uc ON uc.user_id = u.id
     WHERE u.id = $1`,
    [CONSENT_E2E_USER_ID]
  );
  const opinions = await pool.query(
    'SELECT COUNT(*)::int AS count FROM opinioni_risposte WHERE user_id = $1',
    [CONSENT_E2E_USER_ID]
  );
  const ledger = await pool.query(
    `SELECT event_type, details
       FROM privacy_erasure_ledger
      WHERE subject_user_id = $1
        AND event_type = 'political_consent_revoked'
      ORDER BY occurred_at DESC
      LIMIT 1`,
    [CONSENT_E2E_USER_ID]
  );
  return {
    consent: consent.rows[0] || null,
    opinionCount: Number(opinions.rows[0]?.count || 0),
    ledger: ledger.rows[0] || null
  };
}

async function runStagingPoliticalConsentSelfTest({
  env = process.env,
  port = process.env.PORT || 3001,
  fetchImpl = global.fetch,
  tokenFactory,
  pool = getPool(),
  logger = console,
} = {}) {
  if (env.DEMOS_STAGING_POLITICAL_CONSENT_E2E !== 'true') {
    return { mode: 'disabled', passed: 0, total: 4 };
  }
  if (env.NODE_ENV !== 'staging') {
    throw new Error('DEMOS_STAGING_POLITICAL_CONSENT_E2E is allowed only with NODE_ENV=staging');
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for staging political-consent E2E');
  if (!pool || typeof pool.query !== 'function') throw new Error('database pool is required for staging political-consent E2E');

  const makeToken = tokenFactory || ((payload) => require('../utils/jwt').generateAccessToken(payload));
  const token = makeToken({ userId: CONSENT_E2E_USER_ID });
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = { Authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  let passed = 0;

  try {
    await cleanup(pool);
    await createSyntheticUser(pool);

    let response = await fetchImpl(`${baseUrl}/api/amnistia/vota`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8000),
    });
    let body = await expectJson(response, 403, 'political write without consent');
    if (body?.code !== 'POLITICAL_CONSENT_REQUIRED' || body?.consent_required !== true) {
      throw new Error(`unexpected political consent denial: ${JSON.stringify(body)}`);
    }
    logger.log('[staging-political-consent-e2e] political write without consent -> stable 403 PASS');
    passed += 1;

    await setPoliticalConsent(pool, true);
    response = await fetchImpl(`${baseUrl}/api/amnistia/vota`, {
      method: 'POST',
      headers,
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(8000),
    });
    await expectJson(response, 400, 'political write with consent reaches route validation');
    logger.log('[staging-political-consent-e2e] active consent passes shared guard PASS');
    passed += 1;

    await pool.query(
      `INSERT INTO opinioni_risposte (user_id, fonti_opinioni)
       VALUES ($1, '{}'::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET fonti_opinioni = EXCLUDED.fonti_opinioni, updated_at = NOW()`,
      [CONSENT_E2E_USER_ID]
    );

    response = await fetchImpl(`${baseUrl}/api/user/political-opinions-consent/revoke`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({}),
      signal: AbortSignal.timeout(12000),
    });
    body = await expectJson(response, 200, 'political consent revoke');
    if (body?.consent?.granted !== false) {
      throw new Error(`unexpected revoke response: ${JSON.stringify(body)}`);
    }
    logger.log('[staging-political-consent-e2e] revoke endpoint completed PASS');
    passed += 1;

    const finalState = await readFinalState(pool);
    if (!finalState.consent || finalState.consent.legacy_consent !== false || finalState.consent.normalized_consent !== false) {
      throw new Error(`consent was not revoked in both stores: ${JSON.stringify(finalState.consent)}`);
    }
    if (finalState.opinionCount !== 0) {
      throw new Error(`consent-dependent opinion row survived revocation: ${finalState.opinionCount}`);
    }
    const deletedCount = Number(finalState.ledger?.details?.political_records_deleted_count || 0);
    if (finalState.ledger?.event_type !== 'political_consent_revoked' || deletedCount < 1) {
      throw new Error(`durable revocation ledger missing cleanup evidence: ${JSON.stringify(finalState.ledger)}`);
    }
    logger.log('[staging-political-consent-e2e] atomic cleanup + dual-store revoke + durable ledger PASS');
    passed += 1;

    logger.log(`[staging-political-consent-e2e] PASS ${passed}/4`);
    return { mode: 'political-consent-e2e', passed, total: 4 };
  } finally {
    try {
      await cleanup(pool);
      logger.log('[staging-political-consent-e2e] cleanup PASS');
    } catch (cleanupError) {
      logger.error(`[staging-political-consent-e2e] cleanup FAILED: ${cleanupError.message}`);
      throw cleanupError;
    }
  }
}

module.exports = {
  CONSENT_E2E_USER_ID,
  cleanup,
  createSyntheticUser,
  setPoliticalConsent,
  readFinalState,
  runStagingPoliticalConsentSelfTest,
};
