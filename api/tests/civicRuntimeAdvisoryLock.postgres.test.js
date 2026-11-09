'use strict';
// Real PostgreSQL advisory-lock behavior on a disposable CI-only database.
// NEVER run this on a shared staging, production or local user database.
const test = require('node:test');
const assert = require('node:assert/strict');
const {Client} = require('pg');

const FIXTURE = 'postgresql://postgres:civic_ci_only@127.0.0.1:5432/civic_ci';
const LOCK_NAMESPACE = 159823041;
const LOCK_KEY = 20261104;

test('runtime role can hold an exclusive session advisory lock across transactions', async () => {
  // Reject the wrong environment before constructing any connection.
  assert.equal(process.env.CIVIC_TEST_DATABASE_URL, FIXTURE, 'EPHEMERAL_FIXTURE_ONLY');
  assert.equal(process.env.DATABASE_URL || '', '', 'NO_APPLICATION_DATABASE_URL');
  assert.equal(process.env.CIVIC_STAGING_SESSION_DATABASE_URL || '', '', 'NO_SHARED_STAGING_SOCKET');
  assert.equal(process.env.CIVIC_UNIFIED_STAGING_READY || '', '', 'NO_STAGING_RUNTIME_GO');
  assert.equal(process.env.CIVIC_NEW_INITIATIVE_PUSH_ENABLED || '', '', 'NO_REAL_PUSH');
  assert.ok(['16', '17'].includes(process.env.CIVIC_CI_POSTGRES_MAJOR), 'PG16_OR_17_ONLY');

  const clients = [new Client({connectionString: FIXTURE, connectionTimeoutMillis: 5000, query_timeout: 5000}),
    new Client({connectionString: FIXTURE, connectionTimeoutMillis: 5000, query_timeout: 5000})];
  const connected = [];
  try {
    for (const client of clients) {
      await client.connect();
      connected.push(client);
      // The fixture superuser is used for setup only; the lock protocol is
      // exercised as the restricted, synthetic DEMOS application role.
      await client.query('SET ROLE demos_staging_runtime');
      await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
      const meta = await client.query(
        "SELECT current_user::text AS role, current_database()::text AS db, " +
        "current_setting('default_transaction_read_only') AS readonly, " +
        "current_setting('server_version_num') AS version, pg_backend_pid() AS pid");
      const row = meta.rows[0];
      assert.equal(row.role, 'demos_staging_runtime');
      assert.equal(row.db, 'civic_ci');
      assert.equal(row.readonly, 'on');
      assert.equal(Math.floor(Number(row.version) / 10000),
        Number(process.env.CIVIC_CI_POSTGRES_MAJOR));
      assert.ok(Number.isInteger(row.pid) && row.pid > 0);
    }

    const lock = async client => {
      const result = await client.query(
        'SELECT pg_try_advisory_lock($1::int, $2::int) AS acquired',
        [LOCK_NAMESPACE, LOCK_KEY]);
      return result.rows[0]?.acquired;
    };
    const unlock = async client => {
      const result = await client.query(
        'SELECT pg_advisory_unlock($1::int, $2::int) AS released',
        [LOCK_NAMESPACE, LOCK_KEY]);
      return result.rows[0]?.released;
    };

    assert.equal(await lock(clients[0]), true, 'first session must acquire lock');
    assert.equal(await lock(clients[1]), false, 'second session must be excluded');
    await clients[0].query('BEGIN READ ONLY');
    await clients[0].query('ROLLBACK');
    assert.equal(await lock(clients[1]), false,
      'session-level lock must survive transaction boundary');
    assert.equal(await unlock(clients[0]), true);
    assert.equal(await lock(clients[1]), true,
      'second session must acquire only after first releases');
    assert.equal(await unlock(clients[1]), true);
    assert.equal(await unlock(clients[0]), false, 'lock must not remain held');
  } finally {
    for (const client of connected) {
      try { await client.query('SELECT pg_advisory_unlock_all()'); } catch {}
      try { await client.end(); } catch {}
    }
  }
});