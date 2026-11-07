'use strict';

// Only on a disposable GitHub Actions PostgreSQL 17 service, never Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

test('staging-only candidate refuses unsafe legacy rows and supports independent offices', async () => {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.PROVINCIAL_SCHEMA_CI, 'true');
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGPORT, '5432');
  assert.equal(process.env.PGDATABASE, 'provincial_ci');
  const { Client } = require('pg');
  const db = new Client({ host: '127.0.0.1', port: 5432,
    database: 'provincial_ci', user: 'postgres', password: process.env.PGPASSWORD });
  const migration = fs.readFileSync(
    path.join(__dirname, '..', 'qa', 'provincial_empty_legacy_schema_upgrade_CANDIDATE.sql'),
    'utf8',
  );
  assert.match(migration, /PROVINCIAL_LEGACY_ROWS_NEED_EXPLICIT_MAPPING/);
  assert.doesNotMatch(migration, /\b(?:GRANT|REVOKE|DISABLE ROW LEVEL SECURITY|DROP TABLE)\b/i);
  await db.connect();
  try {
    await db.query('CREATE TABLE public.users (id UUID PRIMARY KEY)');
    await db.query('CREATE TABLE public.political_selections (user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, selected_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, selection_kind TEXT NOT NULL, CONSTRAINT political_selections_pkey PRIMARY KEY (user_id, selected_user_id, selection_kind))');
    await db.query('ALTER TABLE public.political_selections ENABLE ROW LEVEL SECURITY');
    const userId = '00000000-0000-4000-8000-000000000901';
    const subjectId = '00000000-0000-4000-8000-000000000902';
    await db.query('INSERT INTO public.users(id) VALUES ($1),($2)', [userId, subjectId]);

    // Missing approval must reject with no schema change.
    await assert.rejects(
      db.query(migration),
      (error) => error.code === 'P0001' && /PROVINCIAL_DDL_NOT_APPROVED/.test(error.message),
    );
    await db.query('ROLLBACK');
    await db.query("SELECT set_config('demos.provincial_ddl_approval','reviewed-empty-staging-only',false)");
    await db.query("SELECT set_config('demos.staging_project_ref','fkeayjzvtuvzesljhjbc',false)");

    // Never invent an office ID for an existing legacy choice.
    await db.query("INSERT INTO public.political_selections(user_id,selected_user_id,selection_kind) VALUES ($1,$2,'representative')", [userId, subjectId]);
    await assert.rejects(
      db.query(migration),
      (error) => error.code === 'P0001' && /PROVINCIAL_LEGACY_ROWS_NEED_EXPLICIT_MAPPING/.test(error.message),
    );
    await db.query('ROLLBACK');
    const unchanged = await db.query("SELECT EXISTS(SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.political_selections'::regclass AND attname='political_office_id' AND NOT attisdropped) AS upgraded");
    assert.equal(unchanged.rows[0].upgraded, false);
    await db.query('DELETE FROM public.political_selections');

    // Approval remains scoped to this disposable CI database.
    await db.query(migration);
    const rls = await db.query("SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='public.political_selections'::regclass");
    assert.equal(rls.rows[0].relrowsecurity, true);
    await db.query("INSERT INTO public.political_selections(user_id,selected_user_id,selection_kind,jurisdiction_id,political_office_id) VALUES ($1,$2,'representative','it','it.regional'),($1,$2,'representative','it','it.provincial.trento')", [userId, subjectId]);
    const stored = await db.query('SELECT political_office_id FROM public.political_selections ORDER BY political_office_id');
    assert.deepEqual(stored.rows.map((row) => row.political_office_id), ['it.provincial.trento', 'it.regional']);
    await assert.rejects(
      db.query("INSERT INTO public.political_selections(user_id,selected_user_id,selection_kind,jurisdiction_id,political_office_id) VALUES ($1,$2,'representative','it','it.regional')", [userId, subjectId]),
      { code: '23505' },
    );
    const pk = await db.query("SELECT pg_catalog.pg_get_constraintdef(oid) AS definition FROM pg_catalog.pg_constraint WHERE conrelid='public.political_selections'::regclass AND contype='p'");
    assert.match(pk.rows[0].definition, /PRIMARY KEY \(id\)/);
  } finally {
    await db.end();
  }
});
