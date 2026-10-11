'use strict';

const { getPool } = require('../config/database');
const { closeElectionLifecycle } = require('../services/electionLifecycleService');
const {
  E2E_USER_ID,
  E2E_ACTIVIST_USER_ID,
  E2E_ADMIN_USER_ID,
} = require('./stagingMigrate');

const EVENT_ID = '00000000-0000-4000-8000-000000000019';
const WINNER_CANDIDACY_ID = '00000000-0000-4000-8000-000000000020';
const LOSER_CANDIDACY_ID = '00000000-0000-4000-8000-000000000021';
const MANDATE_ID = '00000000-0000-4000-8000-000000000022';
const TEST_SOURCE = 'STAGING_E2E_LIFECYCLE';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function runStagingElectionLifecycleSelfTest({
  env = process.env,
  pool = getPool(),
  logger = console,
} = {}) {
  if (env.DEMOS_STAGING_ELECTION_LIFECYCLE_E2E !== 'true') {
    return { mode: 'disabled', passed: 0, total: 5 };
  }
  if (env.NODE_ENV !== 'staging') {
    throw new Error('DEMOS_STAGING_ELECTION_LIFECYCLE_E2E is allowed only with NODE_ENV=staging');
  }
  if (!pool || typeof pool.connect !== 'function') throw new Error('database pool is required for staging election lifecycle E2E');

  const client = await pool.connect();
  let transactionStarted = false;
  let passed = 0;
  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const users = await client.query(
      `SELECT id::text AS id
       FROM users
       WHERE id::text = ANY($1::text[])`,
      [[E2E_USER_ID, E2E_ACTIVIST_USER_ID, E2E_ADMIN_USER_ID]],
    );
    assert(users.rows.length === 3, 'synthetic staging users are not fully seeded');

    await client.query(
      `INSERT INTO eventi (
         id, nome_evento, tipologia_evento, tipo_elezione,
         giorno_inizio, giorno_fine, creator_user_id, approval_status
       ) VALUES (
         $1, 'DEMOS E2E Election Lifecycle', 'Elezioni', 'regionali',
         CURRENT_DATE - 2, CURRENT_DATE - 1, $2, 'APPROVED'
       )`,
      [EVENT_ID, E2E_ADMIN_USER_ID],
    );

    await client.query(
      `INSERT INTO political_candidacies (
         id, user_id, election_event_id, jurisdiction, status, starts_at, source, legacy_context
       ) VALUES
         ($1, $3, $5, '{"country":"IT","level":"R"}'::jsonb, 'ACTIVE', NOW() - INTERVAL '2 days', $6, '{"purpose":"election_lifecycle_e2e","result":"winner"}'::jsonb),
         ($2, $4, $5, '{"country":"IT","level":"R"}'::jsonb, 'ACTIVE', NOW() - INTERVAL '2 days', $6, '{"purpose":"election_lifecycle_e2e","result":"loser"}'::jsonb)`,
      [WINNER_CANDIDACY_ID, LOSER_CANDIDACY_ID, E2E_ACTIVIST_USER_ID, E2E_ADMIN_USER_ID, EVENT_ID, TEST_SOURCE],
    );

    await client.query(
      `INSERT INTO political_mandates (
         id, user_id, election_event_id, office_code, jurisdiction, status, starts_at, source, legacy_context
       ) VALUES (
         $1, $2, $3, 'R', '{"country":"IT","level":"R"}'::jsonb,
         'ACTIVE', NOW() - INTERVAL '1 day', $4, '{"purpose":"election_lifecycle_e2e"}'::jsonb
       )`,
      [MANDATE_ID, E2E_ACTIVIST_USER_ID, EVENT_ID, TEST_SOURCE],
    );

    await client.query(
      `INSERT INTO political_programs (candidacy_id, user_id, content)
       VALUES
         ($1, $3, '{"proposals":[{"text":"winner-program","url":""}]}'::jsonb),
         ($2, $4, '{"proposals":[{"text":"loser-program","url":""}]}'::jsonb)`,
      [WINNER_CANDIDACY_ID, LOSER_CANDIDACY_ID, E2E_ACTIVIST_USER_ID, E2E_ADMIN_USER_ID],
    );

    await client.query(
      `UPDATE users SET candidato_regionale = $2 WHERE id = $1`,
      [E2E_USER_ID, E2E_ACTIVIST_USER_ID],
    );
    await client.query(
      `INSERT INTO political_selections (
         user_id, selection_kind, jurisdiction_id, political_office_id,
         selected_user_id, selected_candidacy_id, source, context
       ) VALUES ($1, 'candidate', 'it', 'it.regional', $2, $3, $4, '{"purpose":"election_lifecycle_e2e"}'::jsonb)
       ON CONFLICT (user_id, selection_kind, political_office_id)
       DO UPDATE SET selected_user_id = EXCLUDED.selected_user_id,
                     selected_candidacy_id = EXCLUDED.selected_candidacy_id,
                     selected_mandate_id = NULL,
                     source = EXCLUDED.source,
                     context = EXCLUDED.context,
                     updated_at = NOW()`,
      [E2E_USER_ID, E2E_ACTIVIST_USER_ID, WINNER_CANDIDACY_ID, TEST_SOURCE],
    );

    const closedAt = new Date();
    const closure = await closeElectionLifecycle(client, {
      eventId: EVENT_ID,
      closedByUserId: E2E_ADMIN_USER_ID,
      closedAt,
    });

    const candidacies = await client.query(
      `SELECT id::text AS id, status, result
       FROM political_candidacies
       WHERE id::text = ANY($1::text[])
       ORDER BY id::text`,
      [[WINNER_CANDIDACY_ID, LOSER_CANDIDACY_ID]],
    );
    const byId = new Map(candidacies.rows.map((row) => [row.id, row]));
    assert(byId.get(WINNER_CANDIDACY_ID)?.status === 'ENDED' && byId.get(WINNER_CANDIDACY_ID)?.result === 'ELECTED', 'winner candidacy was not closed as ELECTED');
    assert(byId.get(LOSER_CANDIDACY_ID)?.status === 'ENDED' && byId.get(LOSER_CANDIDACY_ID)?.result === 'NOT_ELECTED', 'loser candidacy was not closed as NOT_ELECTED');
    assert(closure.candidaciesEnded === 2 && closure.elected === 1 && closure.notElected === 1, 'closure counters do not match winner/loser lifecycle');
    logger.log('[staging-election-lifecycle-e2e] candidacies -> ELECTED/NOT_ELECTED PASS');
    passed += 1;

    const remainingPrograms = await client.query(
      `SELECT COUNT(*)::int AS count FROM political_programs
       WHERE candidacy_id::text = ANY($1::text[])`,
      [[WINNER_CANDIDACY_ID, LOSER_CANDIDACY_ID]],
    );
    const winnerSnapshot = await client.query(
      `SELECT candidacy_id::text AS candidacy_id, content
       FROM mandate_program_snapshots
       WHERE mandate_id = $1`,
      [MANDATE_ID],
    );
    assert(remainingPrograms.rows[0]?.count === 0, 'closed candidacy programs were not removed');
    assert(winnerSnapshot.rows.length === 1 && winnerSnapshot.rows[0].candidacy_id === WINNER_CANDIDACY_ID, 'winner program was not frozen into the mandate');
    assert(winnerSnapshot.rows[0]?.content?.proposals?.[0]?.text === 'winner-program', 'winner snapshot content does not match the candidacy program');
    logger.log('[staging-election-lifecycle-e2e] winner Program -> mandate snapshot and source removal PASS');
    passed += 1;

    const loserSnapshot = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM mandate_program_snapshots
       WHERE candidacy_id = $1`,
      [LOSER_CANDIDACY_ID],
    );
    assert(loserSnapshot.rows[0]?.count === 0, 'loser program was incorrectly frozen into a mandate snapshot');
    logger.log('[staging-election-lifecycle-e2e] loser Program -> deleted without snapshot PASS');
    passed += 1;

    const canonicalSelection = await client.query(
      `SELECT COUNT(*)::int AS count
       FROM political_selections
       WHERE user_id = $1 AND selection_kind = 'candidate' AND political_office_id = 'it.regional'`,
      [E2E_USER_ID],
    );
    const legacySelection = await client.query(
      `SELECT candidato_regionale FROM users WHERE id = $1`,
      [E2E_USER_ID],
    );
    assert(canonicalSelection.rows[0]?.count === 0, 'canonical candidate support survived election closure');
    assert(legacySelection.rows[0]?.candidato_regionale == null, 'legacy candidate support survived election closure');
    assert(closure.supporterSelectionsCleared >= 2, 'closure did not report both canonical and legacy supporter cleanup');
    logger.log('[staging-election-lifecycle-e2e] candidate support -> canonical + legacy cleared PASS');
    passed += 1;

    const event = await client.query(
      `SELECT election_lifecycle_closed_at, election_lifecycle_closed_by_user_id::text AS closed_by
       FROM eventi WHERE id = $1`,
      [EVENT_ID],
    );
    assert(Boolean(event.rows[0]?.election_lifecycle_closed_at), 'election lifecycle closure timestamp was not persisted');
    assert(event.rows[0]?.closed_by === E2E_ADMIN_USER_ID, 'election lifecycle closer was not persisted');
    logger.log('[staging-election-lifecycle-e2e] election event closure marker PASS');
    passed += 1;

    logger.log(`[staging-election-lifecycle-e2e] PASS ${passed}/5`);
    return { mode: 'election-lifecycle-e2e', passed, total: 5 };
  } finally {
    try {
      if (transactionStarted) await client.query('ROLLBACK');
      logger.log('[staging-election-lifecycle-e2e] cleanup ROLLBACK PASS');
    } finally {
      client.release();
    }
  }
}

module.exports = {
  EVENT_ID,
  WINNER_CANDIDACY_ID,
  LOSER_CANDIDACY_ID,
  MANDATE_ID,
  TEST_SOURCE,
  runStagingElectionLifecycleSelfTest,
};
