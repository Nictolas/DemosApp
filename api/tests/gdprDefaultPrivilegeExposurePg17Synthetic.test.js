'use strict';

// Disposable PG17 CI ONLY. Mirrors the broad DEFAULT PRIVILEGES observed on
// existing Supabase Demos-Staging, without connecting to any real provider.
// All roles, schema, rows and passwords are synthetic and local to CI.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Client}=require('pg');

const URL='postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci';
const ISOLATED=process.env.GITHUB_ACTIONS==='true' &&
  process.env.GDPR_OUTBOX_WORKER_CI==='isolated' &&
  process.env.TEST_DATABASE_URL===URL &&
  !process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL &&
  !process.env.SUPABASE_URL && !process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !process.env.RENDER && !process.env.RENDER_SERVICE_ID &&
  !process.env.GDPR_ERASURE_OUTBOX_WORKER_ENABLED &&
  !process.env.GDPR_LEDGER_B2_ENABLED;

if(!ISOLATED){
  test('default privileges require exact synthetic CI target',
    {skip:'not an authorized provider or runtime test'},()=>{});
}else{
  // Identifiers are CONSTANTS controlled by the fixture, never user input.
  const SCHEMA='gdpr_default_acl_ci';
  const OWNER='gdpr_acl_owner_ci';
  const ANON='gdpr_acl_anon_ci';
  const SERVICE='gdpr_acl_service_ci';
  const db=new Client({connectionString:URL,ssl:false});
  const observer=new Client({connectionString:URL,ssl:false});

  test('new SQL objects inherit broad API grants until atomic RLS+REVOKE protects them',async()=>{
    await db.connect();
    await observer.connect();
    try{
      const check=(await db.query(
        "SELECT current_database() AS db, current_setting('server_version_num')::int AS ver"
      )).rows[0];
      assert.equal(check.db,'gdpr_outbox_worker_ci');
      assert.equal(Math.floor(check.ver/10000),17);

      for(const role of [OWNER,ANON,SERVICE]){
        await db.query('CREATE ROLE '+role+' NOLOGIN NOSUPERUSER NOBYPASSRLS');
      }
      await db.query('CREATE SCHEMA '+SCHEMA+' AUTHORIZATION '+OWNER);
      await db.query('GRANT USAGE ON SCHEMA '+SCHEMA+' TO '+ANON+','+SERVICE);

      // Synthetic mirror of the *observed* default public-schema ACLs for
      // new objects created by privileged owners, without changing real ACLs.
      await db.query('ALTER DEFAULT PRIVILEGES FOR ROLE '+OWNER+
        ' IN SCHEMA '+SCHEMA+' GRANT ALL ON TABLES TO '+ANON+','+SERVICE);

      await db.query('SET ROLE '+OWNER);
      await db.query('CREATE TABLE '+SCHEMA+
        '.unprotected (id TEXT PRIMARY KEY)');
      await db.query('RESET ROLE');
      for(const role of [ANON,SERVICE]){
        assert.equal((await db.query('SELECT has_table_privilege($1,$2,$3) AS granted',
          [role,SCHEMA+'.unprotected','INSERT'])).rows[0].granted,true);
      }
      // Negative control: without RLS and revocation, an API-like role can
      // actually INSERT a fictional row into the newly created table.
      await db.query('SET ROLE '+ANON);
      await db.query('INSERT INTO '+SCHEMA+
        ".unprotected VALUES ('fictional-no-person')");
      await db.query('RESET ROLE');
      assert.equal((await db.query('SELECT count(*)::int AS n FROM '+SCHEMA+
        '.unprotected')).rows[0].n,1);

      await db.query('SET ROLE '+OWNER);
      await db.query('BEGIN');
      await db.query('CREATE TABLE '+SCHEMA+
        '.hardened (id TEXT PRIMARY KEY)');
      // The future table is not visible to other connections before COMMIT.
      const uncommitted=(await observer.query(
        'SELECT to_regclass($1) AS relation',[SCHEMA+'.hardened']
      )).rows[0].relation;
      assert.equal(uncommitted,null);
      await db.query('ALTER TABLE '+SCHEMA+
        '.hardened ENABLE ROW LEVEL SECURITY');
      await db.query('ALTER TABLE '+SCHEMA+
        '.hardened FORCE ROW LEVEL SECURITY');
      await db.query('REVOKE ALL ON TABLE '+SCHEMA+
        '.hardened FROM '+ANON+','+SERVICE);
      await db.query('COMMIT');
      await db.query('RESET ROLE');
      assert.equal((await observer.query(
        'SELECT to_regclass($1) IS NOT NULL AS present',[SCHEMA+'.hardened']
      )).rows[0].present,true);
      for(const role of [ANON,SERVICE]){
        for(const permission of ['SELECT','INSERT','UPDATE','DELETE']){
          assert.equal((await db.query(
            'SELECT has_table_privilege($1,$2,$3) AS granted',
            [role,SCHEMA+'.hardened',permission]
          )).rows[0].granted,false,role+' '+permission);
        }
      }
      const state=(await db.query(
        'SELECT relrowsecurity,relforcerowsecurity FROM pg_catalog.pg_class '+
        'WHERE oid=$1::regclass',[SCHEMA+'.hardened']
      )).rows[0];
      assert.deepEqual(state,{relrowsecurity:true,relforcerowsecurity:true});
    }finally{
      // Only the synthetic roles/schema in the disposable PG17 CI DB.
      try{await db.query('ROLLBACK').catch(()=>{});}catch(_){}
      try{await db.query('RESET ROLE').catch(()=>{});}catch(_){}
      try{await db.query('ALTER DEFAULT PRIVILEGES FOR ROLE '+OWNER+
        ' IN SCHEMA '+SCHEMA+' REVOKE ALL ON TABLES FROM '+ANON+','+SERVICE)
        .catch(()=>{});}catch(_){}
      try{await db.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE').catch(()=>{});}catch(_){}
      for(const role of [ANON,SERVICE,OWNER]){
        try{await db.query('DROP OWNED BY '+role+' CASCADE').catch(()=>{});}catch(_){}
        try{await db.query('DROP ROLE IF EXISTS '+role).catch(()=>{});}catch(_){}
      }
      await observer.end().catch(()=>{});
      await db.end().catch(()=>{});
    }
  });
}
