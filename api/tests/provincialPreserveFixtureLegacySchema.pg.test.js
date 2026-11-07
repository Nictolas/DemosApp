'use strict';

// Exercises only an ephemeral PostgreSQL 17 instance owned by CI.
// Nothing here connects to, modifies or copies Demos-Staging or production.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { loadPoliticalSelections } = require('../services/politicalSelectionService');

test('preserve fixture-only legacy choices without inventing an office', async () => {
  assert.equal(process.env.GITHUB_ACTIONS, 'true');
  assert.equal(process.env.PROVINCIAL_SCHEMA_CI, 'true');
  assert.equal(process.env.PGHOST, '127.0.0.1');
  assert.equal(process.env.PGPORT, '5432');
  assert.equal(process.env.PGDATABASE, 'provincial_ci');
  const { Client } = require('pg');
  const db = new Client({ host: '127.0.0.1', port: 5432,
    database: 'provincial_ci', user: 'postgres', password: process.env.PGPASSWORD });
  const migration = fs.readFileSync(path.join(
    __dirname, '..', 'qa', 'provincial_preserve_fixture_legacy_schema_upgrade_CANDIDATE.sql',
  ), 'utf8');
  assert.match(migration, /PROVINCIAL_NONFIXTURE_LEGACY_ROWS/);
  assert.match(migration, /legacy_unmapped/);
  assert.doesNotMatch(migration, /\b(?:GRANT|REVOKE|DISABLE ROW LEVEL SECURITY|DROP TABLE)\b/i);

  const alice = '00000000-0000-4000-8000-000000000301';
  const bob = '00000000-0000-4000-8000-000000000302';
  const outsider = '00000000-0000-4000-8000-000000000903';
  await db.connect();
  try {
    await db.query('CREATE TABLE public.users (id UUID PRIMARY KEY)');
    await db.query('CREATE TABLE public.political_selections (user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, selected_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, selection_kind TEXT NOT NULL, CONSTRAINT political_selections_pkey PRIMARY KEY (user_id, selected_user_id, selection_kind))');
    await db.query('ALTER TABLE public.political_selections ENABLE ROW LEVEL SECURITY');
    await db.query('INSERT INTO public.users(id) VALUES ($1),($2),($3)', [alice,bob,outsider]);
    await db.query("INSERT INTO public.political_selections(user_id,selected_user_id,selection_kind) VALUES ($1,$2,'candidate'),($2,$1,'representative')", [alice,bob]);

    // No approval: rollback leaves legacy columns unchanged.
    await assert.rejects(db.query(migration), (err) =>
      err.code === 'P0001' && /PROVINCIAL_DDL_NOT_APPROVED/.test(err.message));
    await db.query('ROLLBACK');
    await db.query("SELECT set_config('demos.provincial_ddl_approval','reviewed-preserve-gdpr-fixtures-staging-only',false)");
    await db.query("SELECT set_config('demos.staging_project_ref','fkeayjzvtuvzesljhjbc',false)");

    // Unknown owner triggers rejection; never convert an unrelated user's choice.
    await db.query("INSERT INTO public.political_selections(user_id,selected_user_id,selection_kind) VALUES ($1,$2,'candidate')", [outsider,bob]);
    await assert.rejects(db.query(migration), (err) =>
      err.code === 'P0001' && /PROVINCIAL_NONFIXTURE_LEGACY_ROWS/.test(err.message));
    await db.query('ROLLBACK');
    await db.query('DELETE FROM public.political_selections WHERE user_id=$1', [outsider]);

    // A known fixture owner selecting an unknown account is not sufficient.
    await db.query('UPDATE public.political_selections SET selected_user_id=$1 WHERE user_id=$2', [outsider,alice]);
    await assert.rejects(db.query(migration), (err) =>
      err.code === 'P0001' && /PROVINCIAL_NONFIXTURE_LEGACY_ROWS/.test(err.message));
    await db.query('ROLLBACK');
    await db.query('UPDATE public.political_selections SET selected_user_id=$1 WHERE user_id=$2', [bob,alice]);

    // Even if all user IDs are known, unexpected legacy kinds require review.
    await db.query("UPDATE public.political_selections SET selection_kind='unknown' WHERE user_id=$1", [alice]);
    await assert.rejects(db.query(migration), (err) =>
      err.code === 'P0001' && /PROVINCIAL_UNKNOWN_LEGACY_SELECTION_KIND/.test(err.message));
    await db.query('ROLLBACK');
    await db.query("UPDATE public.political_selections SET selection_kind='candidate' WHERE user_id=$1", [alice]);

    // Referencing the old PK must also abort with no partial schema conversion.
    await db.query('CREATE TABLE public.fixture_incoming_fk (user_id UUID, selected_user_id UUID, selection_kind TEXT, FOREIGN KEY (user_id,selected_user_id,selection_kind) REFERENCES public.political_selections(user_id,selected_user_id,selection_kind))');
    await assert.rejects(db.query(migration), (err) =>
      err.code === 'P0001' && /PROVINCIAL_LEGACY_PK_REFERENCED/.test(err.message));
    await db.query('ROLLBACK');
    await db.query('DROP TABLE public.fixture_incoming_fk');

    const noColumn = await db.query("SELECT EXISTS (SELECT 1 FROM pg_catalog.pg_attribute WHERE attrelid='public.political_selections'::regclass AND attname='political_office_id' AND NOT attisdropped) AS upgraded");
    assert.equal(noColumn.rows[0].upgraded, false);
    const countBefore = await db.query('SELECT count(*)::int AS n FROM public.political_selections');
    assert.equal(countBefore.rows[0].n, 2);

    // Verified candidate conversion on disposable CI database only.
    await db.query(migration);
    const historical = await db.query("SELECT source,jurisdiction_id,political_office_id,selection_kind FROM public.political_selections ORDER BY selection_kind");
    assert.equal(historical.rows.length, 2);
    assert.deepEqual(historical.rows.map(row => row.source), ['legacy_unmapped','legacy_unmapped']);
    assert.ok(historical.rows.every(row => row.jurisdiction_id === null && row.political_office_id === null));
    const pk = await db.query("SELECT pg_catalog.pg_get_constraintdef(oid) AS definition FROM pg_catalog.pg_constraint WHERE conrelid='public.political_selections'::regclass AND contype='p'");
    assert.match(pk.rows[0].definition, /PRIMARY KEY \(id\)/);
    const rls = await db.query("SELECT relrowsecurity FROM pg_catalog.pg_class WHERE oid='public.political_selections'::regclass");
    assert.equal(rls.rows[0].relrowsecurity, true);

    // Same person may be chosen at regional + provincial office independently.
    await db.query("INSERT INTO public.political_selections(user_id,selected_user_id,selection_kind,jurisdiction_id,political_office_id) VALUES ($1,$2,'representative','it','it.regional'),($1,$2,'representative','it','it.provincial.trento')", [alice,bob]);
    const choices = await db.query("SELECT political_office_id,source FROM public.political_selections WHERE political_office_id IS NOT NULL ORDER BY political_office_id");
    assert.deepEqual(choices.rows, [
      { political_office_id: 'it.provincial.trento', source: 'matching' },
      { political_office_id: 'it.regional', source: 'matching' },
    ]);
    await assert.rejects(
      db.query("INSERT INTO public.political_selections(user_id,selected_user_id,selection_kind,jurisdiction_id,political_office_id) VALUES ($1,$2,'representative','it','it.regional')", [alice,bob]),
      { code: '23505' },
    );
    const all = await db.query('SELECT count(*)::int AS n FROM public.political_selections');
    assert.equal(all.rows[0].n, 4);
    const aliceState = await loadPoliticalSelections(db, { userId: alice, kind: 'representative' });
    assert.equal(aliceState.source, 'CANONICAL');
    assert.deepEqual(aliceState.selections.map(row => row.officeId).sort(),
      ['it.provincial.trento', 'it.regional']);
    const bobState = await loadPoliticalSelections(db, { userId: bob, kind: 'representative' });
    assert.equal(bobState.strict, true);
    assert.deepEqual(bobState.selections, [], 'unmapped historical fixture is not a political office');
  } finally {
    await db.end();
  }
});
