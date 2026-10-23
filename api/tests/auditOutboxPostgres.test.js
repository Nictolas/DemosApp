'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const { createAuditOutbox } = require('../services/auditOutboxService');

test('proposed private SQL schema enforces privileges, retry, ACK and dead-letter in PostgreSQL', async () => {
  const doc = fs.readFileSync(path.join(__dirname, '../../docs/operations/AUDIT_OUTBOX_DESIGN_2026-10-21.md'), 'utf8');
  const migrations = [...doc.matchAll(/```sql\r?\n([\s\S]*?)\r?\n```/g)];
  assert.equal(migrations.length, 2, 'both staging migrations must be documented');

  const db = new PGlite();
  await db.waitReady;
  try {
    // PGlite starts with an empty cluster; Supabase creates these client roles.
    await db.exec('CREATE ROLE anon; CREATE ROLE authenticated;');
    await db.exec(migrations[0][1]);
    await db.exec(migrations[1][1]);
    const role = await db.query("SELECT rolcanlogin, rolbypassrls, rolsuper FROM pg_roles WHERE rolname='demos_outbox_worker'");
    assert.equal(role.rows.length, 1);
    assert.deepEqual(Object.values(role.rows[0]), [false, false, false]);
    const access = await db.query(`SELECT
      has_table_privilege('anon', 'demos_private.audit_delivery_outbox', 'SELECT') AS anon_select,
      has_table_privilege('authenticated', 'demos_private.audit_delivery_outbox', 'SELECT') AS authenticated_select,
      (SELECT relrowsecurity FROM pg_class WHERE oid='demos_private.audit_delivery_outbox'::regclass) AS rls_enabled`);
    assert.equal(access.rows[0].anon_select, false);
    assert.equal(access.rows[0].authenticated_select, false);
    assert.equal(access.rows[0].rls_enabled, true);

    // PGlite implements SQL/parameterized queries but uses affectedRows instead of rowCount.
    const dbQuery = async (sql, params = []) => {
      const res = await db.query(sql, params);
      return { ...res, rowCount: res.affectedRows ?? res.rows.length };
    };
    const pool = {
      query: dbQuery,
      connect: async () => ({ query: dbQuery, release() {} })
    };
    const event = {
      _time: '2026-10-21T10:00:00.000Z',
      log_type: 'audit',
      action: 'SYNTHETIC_ACTION',
      resource: 'test_resource'
    };
    let attempts = 0;
    const reported = [];
    const outbox = createAuditOutbox({
      pool, random: () => 0.5,
      send: async () => ++attempts >= 2,
      report: code => reported.push(code)
    });
    const id = await outbox.enqueue(event, 'real-time');
    assert.equal((await db.query('SELECT count(*)::int AS n FROM demos_private.audit_delivery_outbox')).rows[0].n, 1);

    const failed = await outbox.drainOnce();
    assert.equal(failed.rescheduled, 1);
    const pending = await db.query('SELECT status, attempt_count FROM demos_private.audit_delivery_outbox WHERE id=$1', [id]);
    assert.equal(pending.rows[0].status, 'pending');
    assert.equal(pending.rows[0].attempt_count, 1);

    // Advance only synthetic due timestamp, not wall clock or production data.
    await db.query("UPDATE demos_private.audit_delivery_outbox SET next_attempt_at=NOW()-INTERVAL '1 second' WHERE id=$1", [id]);
    const delivered = await outbox.drainOnce();
    assert.equal(delivered.delivered, 1);
    assert.equal((await db.query('SELECT count(*)::int AS n FROM demos_private.audit_delivery_outbox')).rows[0].n, 0);

    const failing = createAuditOutbox({
      pool, send: async () => false, report: code => reported.push(code)
    });
    const secondId = await failing.enqueue(event, 'real-time');
    await db.query('UPDATE demos_private.audit_delivery_outbox SET attempt_count=7 WHERE id=$1', [secondId]);
    const dead = await failing.drainOnce();
    assert.equal(dead.deadLettered, 1);
    assert.equal((await db.query('SELECT status FROM demos_private.audit_delivery_outbox WHERE id=$1', [secondId])).rows[0].status, 'dead_letter');
    assert.deepEqual(reported, ['AUDIT_OUTBOX_DEAD_LETTER']);
  } finally {
    await db.close();
  }
});
