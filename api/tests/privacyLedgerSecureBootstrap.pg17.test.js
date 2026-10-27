'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const Ledger=require('../services/privacyErasureLedgerService');

// Never let this test target any non-disposable database, even if accidentally
// supplied with an environment variable in a developer or CI environment.
const uri=process.env.TEST_DATABASE_URL||'';
if (!uri.endsWith('@localhost:5432/privacy_synthetic')) {
  test('GDPR secure bootstrap requires named synthetic localhost DB',{skip:true},()=>{});
} else {
  test('ledger first commit is RLS-protected; API grants remain revoked; event writes never do DDL',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    try{
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      const fixture={userId:'synthetic-test-user',eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,details:{source:'CI synthetic'}};
      await assert.rejects(Ledger.recordEvent(pool,fixture),e=>e?.code==='42P01');
      const absent=await pool.query("SELECT to_regclass('public.privacy_erasure_ledger') AS ledger");
      assert.equal(absent.rows[0].ledger,null,'a GDPR write cannot silently create schema');

      // Model the Supabase Data API roles on ephemeral PostgreSQL 17 only.
      for(const name of ['anon','authenticated','service_role']){
        await pool.query('CREATE ROLE '+name+' NOLOGIN NOBYPASSRLS');
      }
      await Ledger.ensureTable(pool);
      const protectedTable=await pool.query(`
        SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
          pg_get_userbyid(c.relowner)=current_user AS caller_is_owner
        FROM pg_catalog.pg_class c
        WHERE c.oid='public.privacy_erasure_ledger'::regclass
      `);
      assert.deepEqual(protectedTable.rows[0],{rls:true,forced:false,caller_is_owner:true});
      const queryPrivileges=async()=>{
        const r=await pool.query(`
          SELECT COUNT(*)::int AS n FROM pg_catalog.pg_roles
          WHERE rolname IN ('anon','authenticated','service_role')
            AND (has_table_privilege(rolname,'public.privacy_erasure_ledger','SELECT')
              OR has_table_privilege(rolname,'public.privacy_erasure_ledger','INSERT')
              OR has_table_privilege(rolname,'public.privacy_erasure_ledger','UPDATE')
              OR has_table_privilege(rolname,'public.privacy_erasure_ledger','DELETE'))
        `);
        return r.rows[0].n;
      };
      assert.equal(await queryPrivileges(),0,'no API role grants after initial provisioning');

      // Simulate an old table with excessive grants and re-run maintenance.
      await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON
        public.privacy_erasure_ledger TO anon, authenticated, service_role`);
      assert.equal(await queryPrivileges(),3);
      await Ledger.ensureTable(pool);
      assert.equal(await queryPrivileges(),0,'idempotent bootstrap must strip inappropriate grants');

      // A table-level-only ACL check misses PostgreSQL column grants. Such
      // grants must fail closed even while a zero-policy RLS currently masks
      // reads, because a future restored policy could permit access.
      await pool.query('GRANT SELECT (subject_user_id) ON public.privacy_erasure_ledger TO anon');
      const columnGrant=await pool.query(`
        SELECT
          has_table_privilege('anon','public.privacy_erasure_ledger','SELECT') AS table_select,
          has_any_column_privilege('anon','public.privacy_erasure_ledger','SELECT') AS column_select
      `);
      assert.deepEqual(columnGrant.rows[0],{table_select:false,column_select:true});
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'a column-only anon grant must fail closed');
      await Ledger.ensureTable(pool);
      assert.equal(await queryPrivileges(),0,'reprovisioning must revoke column-level anon grants');
      await pool.query('GRANT SELECT (details) ON public.privacy_erasure_ledger TO PUBLIC');
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'PUBLIC column-level grants must fail closed');
      await Ledger.ensureTable(pool);
      await pool.query('GRANT UPDATE (details) ON public.privacy_erasure_ledger TO authenticated');
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'authenticated column-only UPDATE must fail closed');
      await Ledger.ensureTable(pool);

      // A restored or manually altered table may exist but lack the
      // protection needed to accept fresh consent/deletion history.
      await pool.query('ALTER TABLE public.privacy_erasure_ledger DISABLE ROW LEVEL SECURITY');
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'an existing unprotected restored table must reject GDPR events');
      assert.equal((await pool.query('SELECT COUNT(*)::integer AS n FROM public.privacy_erasure_ledger')).rows[0].n,0);
      await Ledger.ensureTable(pool);

      await pool.query('GRANT SELECT ON public.privacy_erasure_ledger TO PUBLIC');
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'PUBLIC table grants cannot be permitted even if RLS is on');
      await Ledger.ensureTable(pool);

      await pool.query('GRANT INSERT ON public.privacy_erasure_ledger TO anon');
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'Supabase API-role INSERT grant must be rejected before a write');
      await Ledger.ensureTable(pool);
      assert.equal(await queryPrivileges(),0);

      const recorded=await Ledger.recordEvent(pool,fixture);
      assert.equal(recorded.event_type,Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED);
      const one=await pool.query('SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger');
      assert.equal(one.rows[0].n,1,'secure re-provisioning must preserve GDPR history');
      const owner=await pool.query(`
        SELECT relrowsecurity AS rls FROM pg_catalog.pg_class
        WHERE oid='public.privacy_erasure_ledger'::regclass
      `);
      assert.equal(owner.rows[0].rls,true);
      // Model an independent backend SQL role on the same disposable PG17.
      // A table grant is insufficient if RLS has zero policies; no production
      // role identity or permission can be inferred from owner-only CI.
      await pool.query('CREATE ROLE gdpr_nonowner_ci NOLOGIN NOBYPASSRLS');
      await pool.query('GRANT USAGE ON SCHEMA public TO gdpr_nonowner_ci');
      await pool.query('GRANT SELECT, INSERT ON public.privacy_erasure_ledger TO gdpr_nonowner_ci');
      const nonowner=await pool.connect();
      try {
        await nonowner.query('SET ROLE gdpr_nonowner_ci');
        const identity=await nonowner.query('SELECT current_user AS current_role');
        assert.equal(identity.rows[0].current_role,'gdpr_nonowner_ci');
        await assert.rejects(Ledger.recordEvent(nonowner,fixture),
          error=>error?.code==='42501',
          'non-owner with INSERT grant but no RLS policy must be denied');
      } finally {
        await nonowner.query('RESET ROLE');
        nonowner.release();
      }
      assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger')).rows[0].n,1,
        'non-owner rejection must not create another event');
      await pool.query('REVOKE ALL ON public.privacy_erasure_ledger FROM gdpr_nonowner_ci');
      await pool.query('REVOKE USAGE ON SCHEMA public FROM gdpr_nonowner_ci');
      await pool.query('DROP ROLE gdpr_nonowner_ci');
    } finally {
      await pool.end();
    }
  });

  test('GDPR ledger failures roll back previously changed consent and account data',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const userId='synthetic-revocation-user';
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await pool.query(`
        CREATE TABLE users (id text PRIMARY KEY, political_opinions_consent boolean NOT NULL);
        CREATE TABLE political_selections (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id text NOT NULL REFERENCES users(id)
        );
      `);
      await pool.query('INSERT INTO users(id, political_opinions_consent) VALUES ($1,true)',[userId]);
      await pool.query('INSERT INTO political_selections(user_id) VALUES ($1)',[userId]);
      await Ledger.ensureTable(pool);

      // Both actual HTTP routes keep event recording and preceding mutations
      // within one SQL transaction. Model those steps against real PG17.
      for (const failureMode of ['ledger_missing','rls_disabled','api_role_grant']) {
        if (failureMode==='ledger_missing') {
          await pool.query('DROP TABLE public.privacy_erasure_ledger');
        } else if (failureMode==='rls_disabled') {
          await pool.query('ALTER TABLE public.privacy_erasure_ledger DISABLE ROW LEVEL SECURITY');
        } else {
          await pool.query('GRANT INSERT ON public.privacy_erasure_ledger TO anon');
        }

        for (const operation of ['political_consent_revoked','account_deleted']) {
          const client=await pool.connect();
          try {
            await client.query('BEGIN');
            if (operation==='political_consent_revoked') {
              await client.query(
                'UPDATE users SET political_opinions_consent=false WHERE id=$1',[userId]
              );
              await client.query('DELETE FROM political_selections WHERE user_id=$1',[userId]);
            } else {
              await client.query('DELETE FROM political_selections WHERE user_id=$1',[userId]);
              await client.query('DELETE FROM users WHERE id=$1',[userId]);
            }
            await assert.rejects(
              Ledger.recordEvent(client,{
                userId,eventType:Ledger.EVENT_TYPES[operation==='account_deleted'?
                  'ACCOUNT_DELETED':'POLITICAL_CONSENT_REVOKED'],
                details:{source:'transactional-ci-fixture'}
              }),
              error=>error?.code===(failureMode==='ledger_missing'?
                '42P01':'GDPR_LEDGER_SCHEMA_NOT_PROTECTED'),
              'ledger defect must prevent commit after earlier user changes'
            );
          } finally {
            await client.query('ROLLBACK');
            client.release();
          }
          const snapshot=await pool.query(`
            SELECT u.political_opinions_consent AS consent,
              (SELECT COUNT(*)::int FROM political_selections WHERE user_id=$1) AS choices
            FROM users u WHERE u.id=$1
          `,[userId]);
          assert.deepEqual(snapshot.rows,[{consent:true,choices:1}],
            failureMode+' / '+operation+' must roll back every user mutation');
        }
        // Reinstall/protect schema ONLY between fixture phases, never in a
        // user-facing request: also preserves the subsequent phases' safety.
        await Ledger.ensureTable(pool);
      }

      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'UPDATE users SET political_opinions_consent=false WHERE id=$1',[userId]
        );
        await client.query('DELETE FROM political_selections WHERE user_id=$1',[userId]);
        await Ledger.recordEvent(client,{
          userId,eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
          details:{source:'synthetic-success'}
        });
        await client.query('COMMIT');
      } catch(e) {
        await client.query('ROLLBACK');throw e;
      } finally {client.release();}
      const after=await pool.query(`
        SELECT
          (SELECT political_opinions_consent FROM users WHERE id=$1) AS consent,
          (SELECT COUNT(*)::int FROM political_selections WHERE user_id=$1) AS choices,
          (SELECT COUNT(*)::int FROM public.privacy_erasure_ledger) AS ledger_events
      `,[userId]);
      assert.deepEqual(after.rows,[{consent:false,choices:0,ledger_events:1}],
        'after approved protected provisioning, transaction must commit once');
    } finally {
      await pool.end();
    }
  });
}
