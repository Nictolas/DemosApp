'use strict';

const { getPool } = require('../config/database');
const { setPoliticalSelection, loadSupporterUserIds } = require('../services/politicalSelectionService');
const { E2E_USER_ID, E2E_ACTIVIST_USER_ID, E2E_ADMIN_USER_ID } = require('./stagingMigrate');

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

    await setPoliticalSelection(client, {
      userId: E2E_USER_ID,
      kind: 'representative',
      officeValue: 'R',
      selectedUserId: E2E_ACTIVIST_USER_ID,
      source: 'STAGING_E2E_SUPPORTER_SYNC',
      context: { purpose: 'supporter_sync_e2e', step: 'A' },
    });

    let a = await loadSupporterUserIds(client, { selectedUserId: E2E_ACTIVIST_USER_ID, kind: 'representative', officeId: 'it.regional' });
    let b = await loadSupporterUserIds(client, { selectedUserId: E2E_ADMIN_USER_ID, kind: 'representative', officeId: 'it.regional' });
    if (!a.userIds.includes(E2E_USER_ID) || b.userIds.includes(E2E_USER_ID)) {
      throw new Error('initial representative selection did not target only subject A');
    }
    logger.log('[staging-supporter-sync-e2e] selection A -> only A has supporter PASS');
    passed += 1;

    await setPoliticalSelection(client, {
      userId: E2E_USER_ID,
      kind: 'representative',
      officeValue: 'R',
      selectedUserId: E2E_ADMIN_USER_ID,
      source: 'STAGING_E2E_SUPPORTER_SYNC',
      context: { purpose: 'supporter_sync_e2e', step: 'B' },
    });

    a = await loadSupporterUserIds(client, { selectedUserId: E2E_ACTIVIST_USER_ID, kind: 'representative', officeId: 'it.regional' });
    b = await loadSupporterUserIds(client, { selectedUserId: E2E_ADMIN_USER_ID, kind: 'representative', officeId: 'it.regional' });
    if (a.userIds.includes(E2E_USER_ID) || !b.userIds.includes(E2E_USER_ID)) {
      throw new Error('switched representative selection left a stale supporter target');
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
