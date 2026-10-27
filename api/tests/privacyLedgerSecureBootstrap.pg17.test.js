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

      const recorded=await Ledger.recordEvent(pool,fixture);
      assert.equal(recorded.event_type,Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED);
      const one=await pool.query('SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger');
      assert.equal(one.rows[0].n,1,'secure re-provisioning must preserve GDPR history');
      const owner=await pool.query(`
        SELECT relrowsecurity AS rls FROM pg_catalog.pg_class
        WHERE oid='public.privacy_erasure_ledger'::regclass
      `);
      assert.equal(owner.rows[0].rls,true);
    } finally {
      await pool.end();
    }
  });
}
