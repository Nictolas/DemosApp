'use strict';

const { getPool } = require('../config/database');
const { E2E_USER_ID, E2E_ADMIN_USER_ID } = require('./stagingMigrate');

const TEST_PREFIX = 'DEMOS E2E F12-21';

async function expectJson(response, expectedStatus, label) {
  let body = null;
  try { body = await response.json(); } catch (_) {}
  if (response.status !== expectedStatus) {
    throw new Error(`${label}: expected ${expectedStatus}, got ${response.status}${body ? ` ${JSON.stringify(body)}` : ''}`);
  }
  return body;
}

async function readProposal(db, id) {
  try {
    const result = await db.query('SELECT id::text AS id, text FROM opinioni_proposte WHERE id::text = $1', [String(id)]);
    if (result.rows[0]) return { table: 'opinioni_proposte', ...result.rows[0] };
  } catch (error) {
    if (error?.code !== '42P01') throw error;
  }
  const fallback = await db.query('SELECT id::text AS id, text FROM opinioni_domande WHERE id::text = $1', [String(id)]);
  return fallback.rows[0] ? { table: 'opinioni_domande', ...fallback.rows[0] } : null;
}

async function directCleanupProposal(db, id) {
  if (!id) return;
  const proposalId = String(id);
  await db.query('DELETE FROM voti_opinioni_proposte WHERE opinione_id::text = $1', [proposalId]);
  await db.query(
    'UPDATE users SET opinione_proposta_id = NULL WHERE id = $1 AND opinione_proposta_id::text = $2',
    [E2E_USER_ID, proposalId],
  );
  try {
    await db.query('DELETE FROM opinioni_proposte WHERE id::text = $1', [proposalId]);
  } catch (error) {
    if (error?.code !== '42P01') throw error;
  }
  await db.query('DELETE FROM opinioni_domande WHERE id::text = $1 AND text LIKE $2', [proposalId, `${TEST_PREFIX}%`]);
}

async function assertCleanSyntheticUser(db) {
  const result = await db.query(
    'SELECT opinione_proposta_id::text AS proposal_id FROM users WHERE id = $1',
    [E2E_USER_ID],
  );
  const proposalId = result.rows[0]?.proposal_id || null;
  if (!proposalId) return;
  const proposal = await readProposal(db, proposalId);
  if (!proposal || !String(proposal.text || '').startsWith(TEST_PREFIX)) {
    throw new Error(`Synthetic E2E user has unrelated pending proposal ${proposalId}`);
  }
  await directCleanupProposal(db, proposalId);
}

async function runStagingOpinionProposalSelfTest({
  env = process.env,
  port = process.env.PORT || 3001,
  fetchImpl = global.fetch,
  tokenFactory,
  pool = getPool(),
  logger = console,
} = {}) {
  if (env.DEMOS_STAGING_OPINION_PROPOSAL_E2E !== 'true') {
    return { mode: 'disabled', passed: 0, total: 5 };
  }
  if (env.NODE_ENV !== 'staging') {
    throw new Error('DEMOS_STAGING_OPINION_PROPOSAL_E2E is allowed only with NODE_ENV=staging');
  }
  if (typeof fetchImpl !== 'function') throw new Error('fetch is required for staging opinion-proposal E2E');
  if (!pool || typeof pool.query !== 'function') throw new Error('database pool is required for staging opinion-proposal E2E');

  const makeToken = tokenFactory || ((payload) => require('../utils/jwt').generateAccessToken(payload));
  const userToken = makeToken({ userId: E2E_USER_ID });
  const adminToken = makeToken({ userId: E2E_ADMIN_USER_ID });
  const baseUrl = `http://127.0.0.1:${port}`;
  const userHeaders = { Authorization: `Bearer ${userToken}`, 'content-type': 'application/json' };
  const adminHeaders = { Authorization: `Bearer ${adminToken}`, 'content-type': 'application/json' };
  const nonce = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const firstText = `${TEST_PREFIX} first ${nonce}`;
  const secondText = `${TEST_PREFIX} second ${nonce}`;

  let firstId = null;
  let secondId = null;
  let passed = 0;

  try {
    await assertCleanSyntheticUser(pool);

    let response = await fetchImpl(`${baseUrl}/api/opinioni-proposte`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ testo: firstText }),
      signal: AbortSignal.timeout(8000),
    });
    let body = await expectJson(response, 200, 'first proposal');
    firstId = String(body?.data?.id || '');
    if (!firstId) throw new Error('first proposal did not return an id');

    const marker1 = await pool.query(
      'SELECT opinione_proposta_id::text AS proposal_id FROM users WHERE id = $1',
      [E2E_USER_ID],
    );
    const vote1 = await pool.query(
      'SELECT COUNT(*)::int AS count FROM voti_opinioni_proposte WHERE utente_id = $1 AND opinione_id::text = $2',
      [E2E_USER_ID, firstId],
    );
    if (marker1.rows[0]?.proposal_id !== firstId || vote1.rows[0]?.count !== 1) {
      throw new Error('first proposal marker/automatic vote mismatch');
    }
    logger.log('[staging-proposal-e2e] first pending proposal + automatic vote PASS');
    passed += 1;

    response = await fetchImpl(`${baseUrl}/api/opinioni-proposte`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ testo: secondText }),
      signal: AbortSignal.timeout(8000),
    });
    body = await expectJson(response, 409, 'second concurrent pending proposal');
    if (body?.error !== 'PROPOSTA_PENDENTE_ESISTENTE') {
      throw new Error(`unexpected pending-proposal error: ${body?.error}`);
    }
    const marker2 = await pool.query(
      'SELECT opinione_proposta_id::text AS proposal_id FROM users WHERE id = $1',
      [E2E_USER_ID],
    );
    if (marker2.rows[0]?.proposal_id !== firstId) {
      throw new Error('blocked second proposal altered pending marker');
    }
    logger.log('[staging-proposal-e2e] second pending proposal blocked PASS');
    passed += 1;

    response = await fetchImpl(`${baseUrl}/api/opinioni-proposte/${encodeURIComponent(firstId)}`, {
      method: 'DELETE',
      headers: adminHeaders,
      signal: AbortSignal.timeout(8000),
    });
    await expectJson(response, 200, 'Admin closes first proposal');

    const marker3 = await pool.query(
      'SELECT opinione_proposta_id::text AS proposal_id FROM users WHERE id = $1',
      [E2E_USER_ID],
    );
    const voteAfterClose = await pool.query(
      'SELECT COUNT(*)::int AS count FROM voti_opinioni_proposte WHERE opinione_id::text = $1',
      [firstId],
    );
    if (marker3.rows[0]?.proposal_id != null || voteAfterClose.rows[0]?.count !== 0 || await readProposal(pool, firstId)) {
      throw new Error('closing proposal did not release marker/votes/proposal row');
    }
    logger.log('[staging-proposal-e2e] Admin close releases proposer + votes PASS');
    passed += 1;
    firstId = null;

    response = await fetchImpl(`${baseUrl}/api/opinioni-proposte`, {
      method: 'POST',
      headers: userHeaders,
      body: JSON.stringify({ testo: secondText }),
      signal: AbortSignal.timeout(8000),
    });
    body = await expectJson(response, 200, 'proposal after closure');
    secondId = String(body?.data?.id || '');
    if (!secondId) throw new Error('proposal after closure did not return an id');

    const marker4 = await pool.query(
      'SELECT opinione_proposta_id::text AS proposal_id FROM users WHERE id = $1',
      [E2E_USER_ID],
    );
    if (marker4.rows[0]?.proposal_id !== secondId) {
      throw new Error('user did not become eligible after closure');
    }
    logger.log('[staging-proposal-e2e] proposer eligible again after closure PASS');
    passed += 1;

    response = await fetchImpl(`${baseUrl}/api/opinioni-proposte/${encodeURIComponent(secondId)}`, {
      method: 'DELETE',
      headers: adminHeaders,
      signal: AbortSignal.timeout(8000),
    });
    await expectJson(response, 200, 'cleanup second proposal');

    const finalMarker = await pool.query(
      'SELECT opinione_proposta_id::text AS proposal_id FROM users WHERE id = $1',
      [E2E_USER_ID],
    );
    const finalVotes = await pool.query(
      'SELECT COUNT(*)::int AS count FROM voti_opinioni_proposte WHERE utente_id = $1 AND opinione_id::text = $2',
      [E2E_USER_ID, secondId],
    );
    if (finalMarker.rows[0]?.proposal_id != null || finalVotes.rows[0]?.count !== 0 || await readProposal(pool, secondId)) {
      throw new Error('final proposal cleanup verification failed');
    }
    logger.log('[staging-proposal-e2e] final cleanup verification PASS');
    passed += 1;
    secondId = null;

    logger.log(`[staging-proposal-e2e] PASS ${passed}/5`);
    return { mode: 'opinion-proposal-e2e', passed, total: 5 };
  } finally {
    try {
      await directCleanupProposal(pool, firstId);
      await directCleanupProposal(pool, secondId);
      logger.log('[staging-proposal-e2e] cleanup PASS');
    } catch (cleanupError) {
      logger.error(`[staging-proposal-e2e] cleanup FAILED: ${cleanupError.message}`);
      throw cleanupError;
    }
  }
}

module.exports = {
  TEST_PREFIX,
  readProposal,
  directCleanupProposal,
  assertCleanSyntheticUser,
  runStagingOpinionProposalSelfTest,
};
