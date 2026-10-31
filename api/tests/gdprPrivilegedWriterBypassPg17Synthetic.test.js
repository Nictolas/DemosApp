'use strict';

// CI-only disposable PG17 proof: freezing an application SQL role cannot fence
// a separate privileged writer. All identities/data here are fictional.
// NEVER import into a backend, use with provider secrets, or run on Supabase.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Pool,Client}=require('pg');

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
  test('privileged-writer negative control requires exact disposable PG17 CI',
    {skip:'only synthetic GitHub Actions database'},()=>{});
}else{
  const SCHEMA='gdpr_privilege_cutoff_ci';
  const APP='gdpr_fictional_app_writer_ci';
  const PRIV='gdpr_fictional_privileged_ci';
  const admin=new Pool({connectionString:URL,ssl:false,max:2});
  const conn=user=>new Client({
    host:'127.0.0.1',port:5432,database:'gdpr_outbox_worker_ci',
    user,password:user===APP?'fake-app-only':'fake-privileged-only',
    ssl:false,connectionTimeoutMillis:1500
  });
  let app,priv;

  test('create fictional, FORCE-RLS table with distinct unprivileged and BYPASSRLS logins',async()=>{
    const v=(await admin.query(
      "SELECT current_database() AS db, current_setting('server_version_num')::int AS ver"
    )).rows[0];
    assert.equal(v.db,'gdpr_outbox_worker_ci');
    assert.equal(Math.floor(v.ver/10000),17);
    await admin.query('CREATE ROLE '+APP+
      " LOGIN PASSWORD 'fake-app-only' NOSUPERUSER NOBYPASSRLS");
    await admin.query('CREATE ROLE '+PRIV+
      " LOGIN PASSWORD 'fake-privileged-only' NOSUPERUSER BYPASSRLS");
    await admin.query('CREATE SCHEMA '+SCHEMA);
    await admin.query('REVOKE ALL ON SCHEMA '+SCHEMA+' FROM PUBLIC');
    await admin.query('CREATE TABLE '+SCHEMA+
      '.fictional(id text PRIMARY KEY, tag text NOT NULL)');
    await admin.query('ALTER TABLE '+SCHEMA+
      '.fictional ENABLE ROW LEVEL SECURITY');
    await admin.query('ALTER TABLE '+SCHEMA+
      '.fictional FORCE ROW LEVEL SECURITY');
    await admin.query('CREATE POLICY fictional_app_insert ON '+SCHEMA+
      ".fictional FOR INSERT TO "+APP+" WITH CHECK (tag = 'allowed')");
    await admin.query('CREATE POLICY fictional_app_select ON '+SCHEMA+
      ".fictional FOR SELECT TO "+APP+" USING (tag = 'allowed')");
    await admin.query('GRANT USAGE ON SCHEMA '+SCHEMA+' TO '+APP+','+PRIV);
    await admin.query('GRANT SELECT,INSERT ON '+SCHEMA+
      '.fictional TO '+APP+','+PRIV);
    await admin.query('GRANT UPDATE ON '+SCHEMA+'.fictional TO '+PRIV);
    app=conn(APP);
    app.on('error',()=>{}); // expected backend termination in synthetic fixture
    priv=conn(PRIV);
    await app.connect();
    await priv.connect();
    const roles=(await admin.query(
      'SELECT rolname,rolsuper,rolbypassrls FROM pg_catalog.pg_roles '+
      'WHERE rolname=$1 OR rolname=$2 ORDER BY rolname',[APP,PRIV]
    )).rows;
    assert.equal(roles.length,2);
    assert.deepEqual(roles.map(x=>[x.rolname,x.rolsuper,x.rolbypassrls]),[
      [APP,false,false],[PRIV,false,true]
    ]);
  });

  test('app RLS denies restricted row while privileged independent writer bypasses FORCE RLS',async()=>{
    await app.query('INSERT INTO '+SCHEMA+
      ".fictional VALUES ('made-up-app','allowed')");
    await assert.rejects(
      app.query('INSERT INTO '+SCHEMA+
        ".fictional VALUES ('made-up-app-denied','restricted')"),
      /row-level security policy/i
    );
    await priv.query('INSERT INTO '+SCHEMA+
      ".fictional VALUES ('made-up-privileged','restricted')");
    const visible=(await priv.query('SELECT count(*)::int AS n FROM '+
      SCHEMA+".fictional WHERE tag='restricted'")).rows[0].n;
    assert.equal(visible,1);
    assert.equal((await app.query('SELECT count(*)::int AS n FROM '+
      SCHEMA+'.fictional')).rows[0].n,1);
  });

  test('NOLOGIN on app role does not stop an existing app session or independent privileged writer',async()=>{
    await admin.query('ALTER ROLE '+APP+' NOLOGIN');
    const newApp=conn(APP);
    try{
      await assert.rejects(newApp.connect(),
        /not permitted to log in|password authentication failed/i);
    }finally{
      await newApp.end().catch(()=>{});
    }
    // NOLOGIN does not revoke already established sessions.
    assert.equal((await app.query('SELECT count(*)::int AS n FROM '+
      SCHEMA+'.fictional')).rows[0].n,1);
    // The independent login still bypasses FORCE RLS and inserts.
    await priv.query('INSERT INTO '+SCHEMA+
      ".fictional VALUES ('made-up-after-nologin','restricted')");
    assert.equal((await priv.query('SELECT count(*)::int AS n FROM '+
      SCHEMA+".fictional WHERE tag='restricted'")).rows[0].n,2);
  });

  test('terminating all old app sessions STILL leaves independently privileged login able to write',async()=>{
    const pid=(await app.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const killed=(await admin.query(
      'SELECT pg_terminate_backend($1::int) AS killed',[pid]
    )).rows[0].killed;
    assert.equal(killed,true);
    await assert.rejects(
      app.query('SELECT 1'),/terminat|closed|connection|not queryable|ending/i
    );
    // The privileged connection survived the application's SQL fence.
    const before=(await priv.query('SELECT count(*)::int AS n FROM '+
      SCHEMA+'.fictional')).rows[0].n;
    await priv.query('INSERT INTO '+SCHEMA+
      ".fictional VALUES ('made-up-after-app-killed','restricted')");
    const after=(await priv.query('SELECT count(*)::int AS n FROM '+
      SCHEMA+'.fictional')).rows[0].n;
    assert.equal(after,before+1);
    // This synthetic fixture does NOT contain a global/provider cutoff.
    // A real recovery is NEVER authorized by these observations.
  });

  test.after(async()=>{
    try{
      if(app)await app.end().catch(()=>{});
      if(priv)await priv.end().catch(()=>{});
    }finally{
      try{await admin.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE');}
      finally{
        try{await admin.query('DROP ROLE IF EXISTS '+APP);}
        finally{
          try{await admin.query('DROP ROLE IF EXISTS '+PRIV);}
          finally{await admin.end();}
        }
      }
    }
  });
}
