'use strict';

// CI-only PostgreSQL sandbox. Must never be pointed at Supabase or Render.
// Uses disposable fake tables, roles and rows in a GitHub Actions service container.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { IMPORTANT_TABLES, inspectPool } = require('../scripts/attest-db-writer-role');

const fixtureActors = Object.freeze([
  { login: 'demos_ci_person_a', password: 'local-fixture-a' },
  { login: 'demos_ci_person_b', password: 'local-fixture-b' },
  { login: 'demos_ci_person_c', password: 'local-fixture-c' }
]);

const enabled = process.env.CI_EPHEMERAL_PG === 'YES_THIS_IS_CI_ONLY';
test('PostgreSQL 17 sandbox: actual role, FORCE RLS, and isolated fake account rows', {
  skip: !enabled ? 'Requires ephemeral GitHub Actions PostgreSQL service' : false
}, async () => {
  // Fail closed BEFORE opening any database connection.
  if (process.env.GITHUB_ACTIONS !== 'true') throw new Error('PG_SANDBOX_GITHUB_ONLY');
  let target;
  try {
    target = new URL(process.env.PGTEST_URL || '');
  } catch (_) {
    throw new Error('PG_SANDBOX_INVALID_TARGET');
  }
  if (
    target.protocol !== 'postgresql:' ||
    target.hostname !== '127.0.0.1' ||
    target.port !== '5432' ||
    target.pathname !== '/demos_ci' ||
    target.username !== 'postgres'
  ) throw new Error('PG_SANDBOX_INVALID_TARGET');

  const { Pool } = require('pg');
  const admin = new Pool({
    connectionString: process.env.PGTEST_URL,
    ssl: false,
    max: 2,
    connectionTimeoutMillis: 5000
  });
  const subjects = [];
  try {
    for (const actor of fixtureActors) {
      await admin.query("CREATE ROLE " + actor.login + " LOGIN PASSWORD '" + actor.password + "'");
    }

    for (const table of IMPORTANT_TABLES) {
      // Table names are a frozen, code-owned allowlist; no user input.
      assert.match(table, /^[a-z_]+$/);
      await admin.query("CREATE TABLE public." + table + " (id text PRIMARY KEY, owner_name text NOT NULL)");
      await admin.query("ALTER TABLE public." + table + " ENABLE ROW LEVEL SECURITY");
      await admin.query("ALTER TABLE public." + table + " FORCE ROW LEVEL SECURITY");
      await admin.query("GRANT SELECT ON public." + table + " TO " + fixtureActors.map(a => a.login).join(', '));
      await admin.query("CREATE POLICY synthetic_owner_only ON public." + table + " FOR SELECT USING (owner_name = current_user)");
      await admin.query("INSERT INTO public." + table + " (id, owner_name) VALUES ($1,$2),($3,$4)",
        ['fake-a', fixtureActors[0].login, 'fake-b', fixtureActors[1].login]);
    }

    const expectedCounts = [1, 1, 0];
    for (const [index, actor] of fixtureActors.entries()) {
      const subjectPool = new Pool({
        host: '127.0.0.1', port: 5432, database: 'demos_ci',
        user: actor.login, password: actor.password, ssl: false,
        max: 2, connectionTimeoutMillis: 5000
      });
      subjects.push(subjectPool);
      const evidence = await inspectPool(subjectPool);
      assert.equal(evidence.currentRole, actor.login);
      assert.equal(evidence.sessionRole, actor.login);
      assert.equal(evidence.currentBypassRls, false);
      assert.equal(evidence.sessionBypassRls, false);
      assert.equal(evidence.ownerBypass, false);
      assert.equal(evidence.missingRls, false);
      assert.deepEqual(evidence.missingTables, []);
      assert.equal(evidence.gate, 'ROLE_METADATA_OK_E2E_STILL_REQUIRED');
      for (const table of IMPORTANT_TABLES) {
        const rows = await subjectPool.query("SELECT owner_name FROM public." + table + " ORDER BY owner_name");
        assert.equal(rows.rows.length, expectedCounts[index]);
        if (rows.rows.length) assert.equal(rows.rows[0].owner_name, actor.login);
      }
    }

    // A privileged superuser must never pass the role attestation.
    const privileged = await inspectPool(admin);
    assert.equal(privileged.gate, 'NO_GO_PRIVILEGED_ROLE');

    // Simulate a dangerous RLS misconfiguration and verify fail closed.
    const riskTable = IMPORTANT_TABLES[0];
    await admin.query("ALTER TABLE public." + riskTable + " DISABLE ROW LEVEL SECURITY");
    try {
      const unsafe = await inspectPool(subjects[0]);
      assert.equal(unsafe.gate, 'NO_GO_RLS_OFF');
    } finally {
      await admin.query("ALTER TABLE public." + riskTable + " ENABLE ROW LEVEL SECURITY");
    }

    process.stdout.write('PG_SANDBOX_SYNTHETIC_RLS_PASS_NO_REAL_DATA\n');
  } finally {
    await Promise.allSettled(subjects.map(pool => pool.end()));
    await admin.end();
    // The GitHub Actions service container is destroyed after this job.
  }
});
