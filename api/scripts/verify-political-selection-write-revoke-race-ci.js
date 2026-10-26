'use strict';

// Real PostgreSQL 17 cross-transaction race proof on synthetic localhost only.
// Never connects to Supabase/Render, never uses personal or production data.
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { setPoliticalSelection, loadPoliticalSelections, loadSupporterUserIds } = require('../services/politicalSelectionService');

const USER = '00000000-0000-4000-8000-000000000289';
const TARGET = '00000000-0000-4000-8000-000000000290';
const DB = 'political_consent_race_ci';
const timeout = (p, milliseconds = 8500) => Promise.race([
  p, new Promise((_, reject) => setTimeout(() => reject(Error('Synthetic race timeout')), milliseconds))
]);
function gate() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}
function guard() {
  const expected = {
    GITHUB_ACTIONS: 'true',
    POLITICAL_CONSENT_RACE_CI: 'synthetic',
    PGHOST: '127.0.0.1',
    PGPORT: '5432',
    PGDATABASE: DB,
    PGUSER: 'postgres',
    PGPASSWORD: 'synthetic-only'
  };
  for (const [name, value] of Object.entries(expected)) {
    if (process.env[name] !== value) throw Error('Refusing non-synthetic DB: ' + name);
  }
  for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RENDER']) {
    if (process.env[key]) throw Error('Production environment forbidden: ' + key);
  }
}

async function main() {
  guard();
  const real = new Pool({
    host: '127.0.0.1', port: 5432, database: DB, user: 'postgres',
    password: 'synthetic-only', max: 5, connectionTimeoutMillis: 3500,
    statement_timeout: 8000, application_name: 'synthetic_selection_consent_race'
  });
  let hold = null;
  try {
    const meta = (await real.query(
      "SELECT current_database() AS db, current_setting('server_version_num')::integer AS version"
    )).rows[0];
    assert.equal(meta.db, DB);
    assert.equal(Math.floor(meta.version / 10000), 17);
    // The guard above confines these DDL statements to ephemeral GitHub CI.
    await real.query('CREATE TABLE IF NOT EXISTS users (id uuid PRIMARY KEY, political_opinions_consent boolean NOT NULL)');
    await real.query('CREATE TABLE IF NOT EXISTS user_consents (user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await real.query(
      'CREATE TABLE IF NOT EXISTS political_selections (' +
      'user_id uuid NOT NULL, selection_kind text NOT NULL, jurisdiction_id text NOT NULL,' +
      'political_office_id text NOT NULL, selected_user_id uuid NOT NULL,' +
      'selected_candidacy_id uuid, selected_mandate_id uuid, source text, context jsonb,' +
      'updated_at timestamptz DEFAULT NOW(),' +
      'UNIQUE (user_id, selection_kind, political_office_id))'
    );

    async function reset() {
      await real.query('DELETE FROM political_selections WHERE user_id=$1', [USER]);
      await real.query(
        'INSERT INTO users(id,political_opinions_consent) VALUES($1,true) ' +
        'ON CONFLICT(id) DO UPDATE SET political_opinions_consent=true', [USER]
      );
      await real.query(
        'INSERT INTO user_consents(user_id,political_opinions_consent) VALUES($1,true) ' +
        'ON CONFLICT(user_id) DO UPDATE SET political_opinions_consent=true', [USER]
      );
    }
    async function inspect() {
      const state = (await real.query(
        'SELECT COALESCE(uc.political_opinions_consent,u.political_opinions_consent,false) AS granted ' +
        'FROM users u LEFT JOIN user_consents uc ON uc.user_id=u.id WHERE u.id=$1', [USER]
      )).rows[0];
      const choices = (await real.query(
        'SELECT selected_user_id::text AS id FROM political_selections WHERE user_id=$1', [USER]
      )).rows.map(x => x.id);
      return { granted: state.granted, choices };
    }
    async function save(selectedUserId = TARGET) {
      const c = await real.connect();
      let open = false;
      try {
        await c.query('BEGIN');
        open = true;
        const tx = {
          async query(sql, params) {
            const statement = String(sql).replace(/\s+/g, ' ').trim();
            if (hold?.phase === 'revoke' && statement === 'SELECT id FROM public.users WHERE id = $1 FOR UPDATE')
              hold.contender.resolve();
            const answer = await c.query(sql, params);
            if (hold?.phase === 'save' && !hold.paused && statement === 'SELECT id FROM public.users WHERE id = $1 FOR UPDATE') {
              hold.paused = true;
              hold.locked.resolve();
              await timeout(hold.resume.promise);
            }
            return answer;
          }
        };
        try {
          const result = await setPoliticalSelection(tx, {
            userId: USER, kind: 'candidate', officeValue: 'us.house', adapterId: 'us',
            selectedUserId, source: 'matching'
          });
          await c.query('COMMIT');
          open = false;
          return { ok: true, result };
        } catch (error) {
          return { ok: false, code: error.code };
        }
      } finally {
        if (open) await c.query('ROLLBACK');
        c.release();
      }
    }
    async function revoke(pauseAfterLock) {
      const c = await real.connect();
      let open = false;
      try {
        await c.query('BEGIN'); open = true;
        await c.query('UPDATE users SET political_opinions_consent=false WHERE id=$1', [USER]);
        if (pauseAfterLock) {
          hold.locked.resolve();
          await timeout(hold.resume.promise);
        }
        await c.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1', [USER]);
        // Selection erasure is NOT part of the current documented cleanup.
        // Do not invent an erasure policy in this concurrency test.
        await c.query('COMMIT'); open = false;
      } finally {
        if (open) await c.query('ROLLBACK');
        c.release();
      }
    }

    await reset();
    hold = { phase: 'save', locked: gate(), resume: gate(), contender: gate(), paused: false };
    const savedFirst = save();
    await timeout(hold.locked.promise);
    const revokeSecond = revoke(false);
    hold.resume.resolve();
    const before = await timeout(savedFirst);
    assert.equal(before.ok, true, 'Save owns lock before revoke');
    await timeout(revokeSecond);
    assert.deepEqual(await inspect(), { granted: false, choices: [TARGET] },
      'The pending erasure policy is separate; consent must be revoked after save');

    await reset();
    hold = { phase: 'revoke', locked: gate(), resume: gate(), contender: gate() };
    const revokeFirst = revoke(true);
    await timeout(hold.locked.promise);
    const saveSecond = save();
    await timeout(hold.contender.promise);
    hold.resume.resolve();
    await timeout(revokeFirst);
    const after = await timeout(saveSecond);
    assert.equal(after.ok, false);
    assert.equal(after.code, 'POLITICAL_SELECTION_CONSENT_REQUIRED');
    assert.deepEqual(await inspect(), { granted: false, choices: [] },
      'A save started before revoke COMMIT must not resurrect a choice');

    hold = null;
    const revokedDirect = await save();
    assert.equal(revokedDirect.code, 'POLITICAL_SELECTION_CONSENT_REQUIRED');
    assert.deepEqual(await inspect(), { granted: false, choices: [] });

    const removed = await save(null);
    assert.equal(removed.ok, true, 'Voluntary removal remains allowed after revocation');
    assert.deepEqual(await inspect(), { granted: false, choices: [] });

    await reset();
    const ordinary = await save();
    assert.equal(ordinary.ok, true);
    assert.deepEqual(await inspect(), { granted: true, choices: [TARGET] });

    // A non-cooperating borrowed connection may have temporary shadows and
    // search_path=pg_temp,public. A row-lock on pg_temp.users would NOT
    // serialize with the consent revoke on public.users.
    await reset();
    const shadow=await real.connect();
    const revoker=await real.connect();
    let revokerOpen=false;
    try {
      await shadow.query('CREATE TEMP TABLE users (LIKE public.users INCLUDING DEFAULTS)');
      await shadow.query('CREATE TEMP TABLE user_consents (LIKE public.user_consents INCLUDING DEFAULTS)');
      await shadow.query('CREATE TEMP TABLE political_selections (LIKE public.political_selections INCLUDING DEFAULTS)');
      await shadow.query('INSERT INTO pg_temp.users SELECT * FROM public.users WHERE id=$1',[USER]);
      await shadow.query('INSERT INTO pg_temp.user_consents SELECT * FROM public.user_consents WHERE user_id=$1',[USER]);
      const shadowTarget='00000000-0000-4000-8000-000000000291';
      await shadow.query(
        'INSERT INTO pg_temp.political_selections ' +
        '(user_id,selection_kind,jurisdiction_id,political_office_id,selected_user_id,source,context) ' +
        "VALUES ($1,'candidate','us','us.house',$2,'matching','{}'::jsonb)",
        [USER,shadowTarget]
      );
      await shadow.query('SET search_path TO pg_temp, public');
      const writeOnBorrowed=()=>setPoliticalSelection(shadow,{
        userId:USER,kind:'candidate',officeValue:'us.house',adapterId:'us',
        selectedUserId:TARGET,source:'matching'
      });

      // Hold the canonical row exclusively from a separate transaction.
      // lock_timeout makes this a bounded *real PG17* proof of the lock target.
      await revoker.query('BEGIN');revokerOpen=true;
      await revoker.query(
        'UPDATE public.users SET political_opinions_consent=false WHERE id=$1',[USER]);
      await shadow.query('BEGIN');
      await shadow.query("SET LOCAL lock_timeout = '300ms'");
      await assert.rejects(writeOnBorrowed(),
        err=>err.code==='55P03',
        'selection must wait for public.users lock, never pg_temp.users');
      await shadow.query('ROLLBACK');
      await revoker.query('ROLLBACK');revokerOpen=false;

      // The same borrowed session must save ONLY to canonical selections,
      // leaving the conflicting temporary selection unchanged.
      await shadow.query('BEGIN');
      const stored=await writeOnBorrowed();
      assert.equal(stored.canonical.written,true);
      await shadow.query('COMMIT');
      const canonical=await real.query(
        'SELECT selected_user_id::text AS id FROM public.political_selections WHERE user_id=$1',[USER]);
      assert.deepEqual(canonical.rows.map(row=>row.id),[TARGET]);
      const temp=await shadow.query(
        'SELECT selected_user_id::text AS id FROM pg_temp.political_selections WHERE user_id=$1',[USER]);
      assert.deepEqual(temp.rows.map(row=>row.id),[shadowTarget]);

      // Read-back MUST select the canonical row, never a stale or more
      // permissive pg_temp.political_selections record on this same client.
      const choices=await loadPoliticalSelections(shadow,{
        userId:USER,kind:'candidate',adapterId:'us'
      });
      assert.equal(choices.source,'CANONICAL');
      assert.deepEqual(choices.selections.map(choice=>choice.selectedUserId),[TARGET]);

      // This is a disposable PG17 database with synthetic users only. Add
      // just enough schema to exercise the real supporter visibility filter.
      await real.query(
        "ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status text DEFAULT 'a'"
      );
      await real.query(
        'ALTER TABLE public.users ADD COLUMN IF NOT EXISTS rappresentante_camera uuid'
      );
      await real.query(
        "UPDATE public.users SET status='a',rappresentante_camera=$2 WHERE id=$1",
        [USER,TARGET]
      );
      await shadow.query(
        'UPDATE pg_temp.user_consents SET political_opinions_consent=false WHERE user_id=$1',
        [USER]
      );
      const visible=await loadSupporterUserIds(shadow,{
        selectedUserId:TARGET,kind:'candidate',officeId:'us.house'
      });
      assert.equal(visible.source,'CANONICAL');
      assert.deepEqual(visible.userIds,[USER],
        'canonical supporter join must ignore revoked pg_temp consent');
      const shadowOnly=await loadSupporterUserIds(shadow,{
        selectedUserId:shadowTarget,kind:'candidate',officeId:'us.house'
      });
      assert.deepEqual(shadowOnly.userIds,[],
        'shadow-only selection must not fabricate canonical supporters');

      // Force the documented missing-canonical-table fallback via a
      // synthetic adapter; its legacy projection and consent join must
      // still read public.users / public.user_consents.
      const legacyOnlyDb={
        async query(sql,params){
          if(String(sql).includes('FROM public.political_selections ps')){
            const missing=new Error('synthetic canonical table unavailable');
            missing.code='42P01';
            throw missing;
          }
          return shadow.query(sql,params);
        }
      };
      const legacyVisible=await loadSupporterUserIds(legacyOnlyDb,{
        selectedUserId:TARGET,kind:'representative',officeId:'it.camera'
      });
      assert.equal(legacyVisible.source,'LEGACY');
      assert.deepEqual(legacyVisible.userIds,[USER]);

      await real.query(
        'UPDATE public.user_consents SET political_opinions_consent=false WHERE user_id=$1',
        [USER]
      );
      await shadow.query(
        'UPDATE pg_temp.user_consents SET political_opinions_consent=true WHERE user_id=$1',
        [USER]
      );
      const revokedSupporters=await loadSupporterUserIds(shadow,{
        selectedUserId:TARGET,kind:'candidate',officeId:'us.house'
      });
      assert.deepEqual(revokedSupporters.userIds,[],
        'canonical supporter read must reject revoked public consent');
      const revokedLegacy=await loadSupporterUserIds(legacyOnlyDb,{
        selectedUserId:TARGET,kind:'representative',officeId:'it.camera'
      });
      assert.deepEqual(revokedLegacy.userIds,[],
        'legacy fallback must reject public consent revocation');
      console.log('POLITICAL_SELECTION_READ_PUBLIC_SCHEMA_SHADOW_PG17_PASS');

      // Revocation updates public consent, leaving stale pg_temp copies
      // still granting. The next selection must fail, not trust the shadows.
      await real.query(
        'UPDATE public.users SET political_opinions_consent=false WHERE id=$1',[USER]);
      await real.query(
        'UPDATE public.user_consents SET political_opinions_consent=false WHERE user_id=$1',[USER]);
      await shadow.query('BEGIN');
      await assert.rejects(writeOnBorrowed(),
        err=>err.code==='POLITICAL_SELECTION_CONSENT_REQUIRED');
      await shadow.query('ROLLBACK');
      const after=await real.query(
        'SELECT selected_user_id::text AS id FROM public.political_selections WHERE user_id=$1',[USER]);
      assert.deepEqual(after.rows.map(row=>row.id),[TARGET]);
      console.log('POLITICAL_SELECTION_PUBLIC_LOCK_AND_SHADOW_PG17_PASS');
    } finally {
      if (revokerOpen) await revoker.query('ROLLBACK').catch(()=>{});
      revoker.release();
      await shadow.query('ROLLBACK').catch(()=>{});
      await shadow.query('RESET search_path').catch(()=>{});
      await shadow.query('DROP TABLE IF EXISTS pg_temp.political_selections').catch(()=>{});
      await shadow.query('DROP TABLE IF EXISTS pg_temp.user_consents').catch(()=>{});
      await shadow.query('DROP TABLE IF EXISTS pg_temp.users').catch(()=>{});
      shadow.release();
    }

    console.log('POLITICAL_SELECTION_SAVE_REVOKE_PG17_SYNTHETIC_PASS');
  } finally {
    await real.end();
  }
}

main().catch(error => {
  console.error('POLITICAL_SELECTION_SAVE_REVOKE_SYNTHETIC_FAIL', error);
  process.exitCode = 1;
});
