'use strict';

// PostgreSQL 17 ephemeral service only. Never targets Supabase or Render.
// Exercises the exact reviewed staging-only fixture SQL in a second disposable DB.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const migration = fs.readFileSync(path.join(
  __dirname, '../qa/sql/staging_gdpr_fixture_rights_devices_20261102.sql'), 'utf8');
const a = '00000000-0000-4000-8000-000000000301';
const b = '00000000-0000-4000-8000-000000000302';
const outsider = '00000000-0000-4000-8000-000000000303';

function assertSafeCiTarget() {
  if (process.env.CI_EPHEMERAL_PG !== 'YES_THIS_IS_CI_ONLY'
      || process.env.GITHUB_ACTIONS !== 'true') {
    throw new Error('GDPR_FIXTURE_PG_SANDBOX_GITHUB_ONLY');
  }
  let target;
  try { target = new URL(process.env.PGTEST_URL || ''); }
  catch (_) { throw new Error('GDPR_FIXTURE_PG_TARGET_INVALID'); }
  if (target.protocol !== 'postgresql:' || target.hostname !== '127.0.0.1'
      || target.port !== '5432' || target.pathname !== '/demos_ci'
      || target.username !== 'postgres') {
    throw new Error('GDPR_FIXTURE_PG_TARGET_INVALID');
  }
}

test('staging GDPR fixture schema: actual PG17 RLS isolation and zero production I/O', {
  skip: process.env.CI_EPHEMERAL_PG !== 'YES_THIS_IS_CI_ONLY'
}, async () => {
  assertSafeCiTarget(); // before even importing pg or opening a socket
  const { Pool } = require('pg');
  const admin = new Pool({
    connectionString: process.env.PGTEST_URL, ssl: false, max: 1,
    connectionTimeoutMillis: 5000
  });
  const testDbName = 'demos_staging_fixture_ci';
  let disposable, runtime, worker, created = false;
  try {
    for (const command of [
      "CREATE ROLE anon NOLOGIN",
      "CREATE ROLE authenticated NOLOGIN",
      "CREATE ROLE service_role NOLOGIN",
      "CREATE ROLE demos_staging_runtime LOGIN PASSWORD 'synthetic-runtime-ci-only'",
      "CREATE ROLE demos_staging_b2_worker LOGIN PASSWORD 'synthetic-worker-ci-only'"
    ]) await admin.query(command);

    await admin.query('CREATE DATABASE ' + testDbName);
    created = true;
    disposable = new Pool({
      host: '127.0.0.1', port: 5432, database: testDbName,
      user: 'postgres', password: new URL(process.env.PGTEST_URL).password,
      ssl: false, max: 1, connectionTimeoutMillis: 5000
    });
    await disposable.query('CREATE TABLE public.users (id uuid PRIMARY KEY)');
    await disposable.query('INSERT INTO public.users (id) VALUES ($1),($2)', [a, b]);
    await disposable.query('ALTER TABLE public.users ENABLE ROW LEVEL SECURITY');
    await disposable.query('ALTER TABLE public.users FORCE ROW LEVEL SECURITY');
    await disposable.query(`CREATE POLICY gdpr_fixture_users ON public.users
      FOR ALL TO demos_staging_runtime
      USING (id IN ('${a}'::uuid, '${b}'::uuid))
      WITH CHECK (id IN ('${a}'::uuid, '${b}'::uuid))`);
    await disposable.query('GRANT SELECT ON public.users TO demos_staging_runtime');

    // Apply *exactly the same* DDL versioned for real isolated staging.
    await disposable.query(migration);

    const metadata = await disposable.query(`SELECT c.relname, c.relrowsecurity,
      c.relforcerowsecurity, has_table_privilege('anon',c.oid,'SELECT') AS anon_select,
      has_table_privilege('authenticated',c.oid,'SELECT') AS auth_select,
      has_table_privilege('service_role',c.oid,'SELECT') AS service_select,
      has_table_privilege('demos_staging_runtime',c.oid,'INSERT') AS runtime_insert
      FROM pg_class c WHERE c.oid IN
      ('public.user_devices'::regclass,'public.user_rights_requests'::regclass)
      ORDER BY c.relname`);
    assert.equal(metadata.rows.length, 2);
    for (const row of metadata.rows) {
      assert.equal(row.relrowsecurity, true);
      assert.equal(row.relforcerowsecurity, true);
      assert.equal(row.anon_select, false);
      assert.equal(row.auth_select, false);
      assert.equal(row.service_select, false);
      assert.equal(row.runtime_insert, true);
    }

    runtime = new Pool({
      host: '127.0.0.1', port: 5432, database: testDbName,
      user: 'demos_staging_runtime', password: 'synthetic-runtime-ci-only',
      ssl: false, max: 1, connectionTimeoutMillis: 5000
    });
    worker = new Pool({
      host: '127.0.0.1', port: 5432, database: testDbName,
      user: 'demos_staging_b2_worker', password: 'synthetic-worker-ci-only',
      ssl: false, max: 1, connectionTimeoutMillis: 5000
    });

    const role = await runtime.query('SELECT current_user,session_user');
    assert.equal(role.rows[0].current_user, 'demos_staging_runtime');
    assert.equal(role.rows[0].session_user, 'demos_staging_runtime');
    await runtime.query('INSERT INTO public.user_rights_requests (user_id,request_type) VALUES ($1,$2)', [a,'data_export']);
    await runtime.query('INSERT INTO public.user_devices (user_id,fcm_token,platform) VALUES ($1,$2,$3)',
      [b,'SYNTHETIC_CI_TOKEN_NEVER_SENT','synthetic_only']);
    assert.equal((await runtime.query('SELECT count(*)::int AS n FROM public.user_rights_requests')).rows[0].n, 1);
    assert.equal((await runtime.query('SELECT count(*)::int AS n FROM public.user_devices')).rows[0].n, 1);

    // An ID outside the *only* two allowed fixtures must fail at RLS, not by FK.
    await assert.rejects(
      runtime.query('INSERT INTO public.user_rights_requests (user_id,request_type) VALUES ($1,$2)', [outsider,'data_export']),
      err => err && err.code === '42501'
    );
    await assert.rejects(
      runtime.query('INSERT INTO public.user_devices (user_id,fcm_token) VALUES ($1,$2)',
        [outsider,'SYNTHETIC_OUTSIDER_NEVER_SENT']),
      err => err && err.code === '42501'
    );
    await assert.rejects(worker.query('SELECT id FROM public.user_devices'), err => err && err.code === '42501');
    await assert.rejects(worker.query('SELECT id FROM public.user_rights_requests'), err => err && err.code === '42501');

    // Re-running must refuse to mutate any pre-existing schema.
    await assert.rejects(disposable.query(migration),
      err => err && /STAGING_SCHEMA_ALREADY_EXISTS_STOP/.test(err.message));

    process.stdout.write('STAGING_GDPR_FIXTURE_SCHEMA_PG17_RLS_PASS_NO_REAL_DATA\n');
  } finally {
    await Promise.allSettled([runtime, worker, disposable].filter(Boolean).map(p => p.end()));
    if (created) {
      try { await admin.query('DROP DATABASE ' + testDbName + ' WITH (FORCE)'); }
      catch (_) { /* The entire service is destroyed after the CI job. */ }
    }
    await admin.end();
  }
});
