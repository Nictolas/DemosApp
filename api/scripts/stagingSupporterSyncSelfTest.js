'use strict';

const { getPool } = require('../config/database');
const { loadSupporterUserIds } = require('../services/politicalSelectionService');
const { E2E_USER_ID, E2E_ACTIVIST_USER_ID, E2E_ADMIN_USER_ID } = require('./stagingMigrate');

async function writeCanonicalRepresentative(client, selectedUserId, step) {
  await client.query(
    `INSERT INTO political_selections (
       user_id, selection_kind, jurisdiction_id, political_office_id,
       selected_user_id, source, context, updated_at
     ) VALUES ($1, 'representative', 'it', 'it.regional', $2, 'STAGING_E2E_SUPPORTER_SYNC', $3::jsonb, NOW())
     ON CONFLICT (user_id, selection_kind, political_office_id)
     DO UPDATE SET selected_user_id = EXCLUDED.selected_user_id,
                   jurisdiction_id = EXCLUDED.jurisdiction_id,
                   source = EXCLUDED.source,
                   context = EXCLUDED.context,
                   updated_at = NOW()`,
    [E2E_USER_ID, selectedUserId, JSON.stringify({ purpose: 'supporter_sync_e2e', step })],
  );
}

async function runStagingSupporterSyncSelfTest({ env = process.env, pool = getPool(), logger = console } = {}) {
  if (env.DEMOS_STAGING_SUPPORTER_SYNC_E2E !== 'true') {
    return { mode: 'disabled', passed: 0, total: 3 };
  }
  if (env.NODE_ENV !== 'staging') {
    throw new Error('DEMOS_STAGING_SUPPORTER_SYNC_E2E is allowed only with NODE_ENV=staging');
  }

  const client = await pool.connect();
  let transactionStarted = false;
  let passed = 0;
  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const users = await client.query(
      `SELECT id::text AS id FROM users WHERE id::text = ANY($1::text[])`,
      [[E2E_USER_ID, E2E_ACTIVIST_USER_ID, E2E_ADMIN_USER_ID]],
    );
    if (users.rows.length !== 3) throw new Error('synthetic staging users are not fully seeded');

    await writeCanonicalRepresentative(client, E2E_ACTIVIST_USER_ID, 'A');

    let a = await loadSupporterUserIds(client, { selectedUserId: E2E_ACTIVIST_USER_ID, kind: 'representative', officeId: 'it.regional' });
    let b = await loadSupporterUserIds(client, { selectedUserId: E2E_ADMIN_USER_ID, kind: 'representative', officeId: 'it.regional' });
    if (a.source !== 'CANONICAL' || !a.strict || !a.userIds.includes(E2E_USER_ID) || b.userIds.includes(E2E_USER_ID)) {
      throw new Error('initial canonical representative selection did not target only subject A');
    }
    logger.log('[staging-supporter-sync-e2e] selection A -> only A has supporter PASS');
    passed += 1;

    await writeCanonicalRepresentative(client, E2E_ADMIN_USER_ID, 'B');

    a = await loadSupporterUserIds(client, { selectedUserId: E2E_ACTIVIST_USER_ID, kind: 'representative', officeId: 'it.regional' });
    b = await loadSupporterUserIds(client, { selectedUserId: E2E_ADMIN_USER_ID, kind: 'representative', officeId: 'it.regional' });
    if (a.userIds.includes(E2E_USER_ID) || b.source !== 'CANONICAL' || !b.strict || !b.userIds.includes(E2E_USER_ID)) {
      throw new Error('switched canonical selection left a stale supporter target');
    }
    logger.log('[staging-supporter-sync-e2e] switch A -> B removes stale A and targets B PASS');
    passed += 1;

    const rows = await client.query(
      `SELECT selected_user_id::text AS selected_user_id, COUNT(*)::int AS count
       FROM political_selections
       WHERE user_id = $1 AND selection_kind = 'representative' AND political_office_id = 'it.regional'
       GROUP BY selected_user_id`,
      [E2E_USER_ID],
    );
    if (rows.rows.length !== 1 || rows.rows[0].selected_user_id !== E2E_ADMIN_USER_ID || rows.rows[0].count !== 1) {
      throw new Error('canonical selection did not remain single-valued after switch');
    }
    logger.log('[staging-supporter-sync-e2e] canonical office selection remains single-valued PASS');
    passed += 1;

    logger.log(`[staging-supporter-sync-e2e] PASS ${passed}/3`);
    return { mode: 'supporter-sync-e2e', passed, total: 3 };
  } finally {
    try {
      if (transactionStarted) await client.query('ROLLBACK');
      logger.log('[staging-supporter-sync-e2e] cleanup ROLLBACK PASS');
    } finally {
      client.release();
    }
  }
}

module.exports = { runStagingSupporterSyncSelfTest };
