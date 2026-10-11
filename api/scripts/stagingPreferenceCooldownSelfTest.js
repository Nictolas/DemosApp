'use strict';

const { getPool } = require('../config/database');
const { E2E_USER_ID } = require('./stagingMigrate');
const { listPriorityEligiblePopularInitiatives } = require('../services/civicProcessReadService');

const SCOPE = 'iniziative-popolari:preferenza';
const COOLDOWN_MS = 24 * 60 * 60 * 1000;

async function expectJson(response, expectedStatus, label) {
  let body = null;
  try { body = await response.json(); } catch (_) {}
  if (response.status !== expectedStatus) {
    throw new Error(`${label}: expected ${expectedStatus}, got ${response.status}${body ? ` ${JSON.stringify(body)}` : ''}`);
  }
  return body;
}

async function readState(db) {
  const vote = await db.query(
    `SELECT iniziativa_id, timestamp, created_at
       FROM voti_iniziative_popolari
      WHERE userid::text = $1
      ORDER BY timestamp DESC NULLS LAST, created_at DESC NULLS LAST
      LIMIT 1`,
    [E2E_USER_ID],
  );
  const cooldown = await db.query(
    `SELECT last_changed_at
       FROM preference_change_cooldowns
      WHERE user_id = $1 AND scope = $2`,
    [E2E_USER_ID, SCOPE],
  );
  return {
    vote: vote.rows[0] || null,
    cooldown: cooldown.rows[0] || null,
  };
}

async function cleanup(db) {
  await db.query('DELETE FROM voti_iniziative_popolari WHERE userid::text = $1', [E2E_USER_ID]);
  await db.query(
    'DELETE FROM preference_change_cooldowns WHERE user_id = $1 AND scope = $2',
    [E2E_USER_ID, SCOPE],
  );
}

async function runStagingPreferenceCooldownSelfTest({
  env = process.env,
  port = process.env.PORT || 3001,
  fetchImpl = global.fetch,
  tokenFactory,
  pool = getPool(),
  logger = console,
} = {}) {
  if (env.DEMOS_STAGING_PREFERENCE_COOLDOWN_E2E !== 'true') {
    return { mode: 'disabled', passed: 0, total: 5 };
  }
  if (env.NODE_ENV !== 'staging') {
    throw new Error('DEMOS_STAGING_PREFERENCE_COOLDOWN_E2E is allowed only with NODE_ENV=staging');
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for staging preference-cooldown E2E');
  if (!pool || typeof pool.query !== 'function') throw new Error('database pool is required for staging preference-cooldown E2E');

  const makeToken = tokenFactory || ((payload) => require('../utils/jwt').generateAccessToken(payload));
  const userToken = makeToken({ userId: E2E_USER_ID });
  const baseUrl = `http://127.0.0.1:${port}`;
  const headers = { Authorization: `Bearer ${userToken}`, 'content-type': 'application/json' };
  let passed = 0;

  try {
    await cleanup(pool);
    const eligible = await listPriorityEligiblePopularInitiatives(pool);
    if (eligible.length < 2) {
      throw new Error(`staging requires at least two eligible canonical initiatives for F12-25 E2E, found ${eligible.length}`);
    }
    const firstChoice = String(eligible[0].id);
    const secondChoice = String(eligible[1].id);

    let response = await fetchImpl(`${baseUrl}/api/iniziative-popolari/vota`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ voti: [firstChoice] }),
      signal: AbortSignal.timeout(8000),
    });
    let body = await expectJson(response, 200, 'first preference change');
    if (body?.unchanged !== false || String(body?.iniziativaId || '') !== firstChoice) {
      throw new Error(`unexpected first preference response: ${JSON.stringify(body)}`);
    }

    let state = await readState(pool);
    if (String(state.vote?.iniziativa_id || '') !== firstChoice || !state.vote?.timestamp || !state.cooldown?.last_changed_at) {
      throw new Error('first preference change was not persisted with cooldown timestamp');
    }
    const firstCooldownMs = new Date(state.cooldown.last_changed_at).getTime();
    if (!Number.isFinite(firstCooldownMs)) throw new Error('invalid first cooldown timestamp');
    logger.log('[staging-preference-e2e] first choice immediate + cooldown recorded PASS');
    passed += 1;

    response = await fetchImpl(`${baseUrl}/api/iniziative-popolari/vota`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ voti: [firstChoice] }),
      signal: AbortSignal.timeout(8000),
    });
    body = await expectJson(response, 200, 'same preference no-op');
    if (body?.unchanged !== true) {
      throw new Error(`same preference was not treated as no-op: ${JSON.stringify(body)}`);
    }

    state = await readState(pool);
    const noOpCooldownMs = new Date(state.cooldown?.last_changed_at).getTime();
    if (String(state.vote?.iniziativa_id || '') !== firstChoice || noOpCooldownMs !== firstCooldownMs) {
      throw new Error('same-value no-op unexpectedly changed state or cooldown');
    }
    logger.log('[staging-preference-e2e] same choice is a no-op and does not extend cooldown PASS');
    passed += 1;

    response = await fetchImpl(`${baseUrl}/api/iniziative-popolari/vota`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ voti: [secondChoice] }),
      signal: AbortSignal.timeout(8000),
    });
    const blockedBody = await expectJson(response, 409, 'second preference inside cooldown');
    if (blockedBody?.error !== 'PREFERENCE_COOLDOWN' || !blockedBody?.unlockDate) {
      throw new Error(`unexpected cooldown response: ${JSON.stringify(blockedBody)}`);
    }
    const unlockMs = new Date(blockedBody.unlockDate).getTime();
    if (!Number.isFinite(unlockMs) || Math.abs(unlockMs - (firstCooldownMs + COOLDOWN_MS)) > 1500) {
      throw new Error('cooldown unlockDate is not 24 hours after the recorded change');
    }
    state = await readState(pool);
    if (String(state.vote?.iniziativa_id || '') !== firstChoice) {
      throw new Error('blocked preference change altered current state');
    }
    logger.log('[staging-preference-e2e] second change inside 24h blocked with stable 409 PASS');
    passed += 1;

    const agedAt = new Date(Date.now() - COOLDOWN_MS - 5000).toISOString();
    await pool.query(
      'UPDATE voti_iniziative_popolari SET timestamp = $2, created_at = $2 WHERE userid::text = $1',
      [E2E_USER_ID, agedAt],
    );
    await pool.query(
      `UPDATE preference_change_cooldowns
          SET last_changed_at = $3
        WHERE user_id = $1 AND scope = $2`,
      [E2E_USER_ID, SCOPE, agedAt],
    );

    response = await fetchImpl(`${baseUrl}/api/iniziative-popolari/vota`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ voti: [secondChoice] }),
      signal: AbortSignal.timeout(8000),
    });
    body = await expectJson(response, 200, 'preference after 24h boundary');
    if (body?.unchanged !== false || String(body?.iniziativaId || '') !== secondChoice) {
      throw new Error(`unexpected post-cooldown response: ${JSON.stringify(body)}`);
    }

    state = await readState(pool);
    const secondCooldownMs = new Date(state.cooldown?.last_changed_at).getTime();
    if (String(state.vote?.iniziativa_id || '') !== secondChoice || !Number.isFinite(secondCooldownMs) || secondCooldownMs <= firstCooldownMs) {
      throw new Error('preference did not become editable after 24h');
    }
    logger.log('[staging-preference-e2e] preference editable again after 24h PASS');
    passed += 1;

    await cleanup(pool);
    state = await readState(pool);
    if (state.vote || state.cooldown) {
      throw new Error('final synthetic preference cleanup verification failed');
    }
    logger.log('[staging-preference-e2e] final cleanup verification PASS');
    passed += 1;

    logger.log(`[staging-preference-e2e] PASS ${passed}/5`);
    return { mode: 'preference-cooldown-e2e', passed, total: 5 };
  } finally {
    try {
      await cleanup(pool);
      logger.log('[staging-preference-e2e] cleanup PASS');
    } catch (cleanupError) {
      logger.error(`[staging-preference-e2e] cleanup FAILED: ${cleanupError.message}`);
      throw cleanupError;
    }
  }
}

module.exports = {
  SCOPE,
  cleanup,
  readState,
  runStagingPreferenceCooldownSelfTest,
};
