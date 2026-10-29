'use strict';

// Disposable CI-only negative tests of SQL-vs-HTTPS quarantine boundaries.
// Database, identities and HTTP endpoint are fictional; this is NOT Supabase.
// Never import from runtime code, deploy, or point it at production services.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {Pool,Client} = require('pg');

const URL='postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci';
const allowed=process.env.GITHUB_ACTIONS==='true' &&
  process.env.GDPR_OUTBOX_WORKER_CI==='isolated' &&
  process.env.TEST_DATABASE_URL===URL &&
  !process.env.DATABASE_URL && !process.env.SUPABASE_DB_URL &&
  !process.env.GDPR_LEDGER_B2_ENABLED &&
  !process.env.GDPR_ERASURE_OUTBOX_WORKER_ENABLED;
if(!allowed){
  test('two-plane fixture requires exact local disposable PG17 target',
    {skip:'Only supported in isolated GitHub Actions fixture'},()=>{});
} else {
  const ROLE='gdpr_twoplane_writer_ci', SCHEMA='gdpr_twoplane_ci';
  const owner=new Pool({connectionString:URL,ssl:false,max:2});
  const runtimeCredentials={
    host:'127.0.0.1',port:5432,database:'gdpr_outbox_worker_ci',
    user:ROLE,password:'synthetic-two-plane-only',ssl:false,
    connectionTimeoutMillis:1500
  };
  let httpPlaneOpen=true,server,port,sqlClient;
  const readHttp=async()=>{
    const response=await fetch('http://127.0.0.1:'+port+'/fictional-subject',{
      signal:AbortSignal.timeout(2000)
    });
    return {status:response.status,body:await response.json()};
  };
  const querySql=(client=sqlClient)=>client.query(
    'SELECT COUNT(*)::int AS n FROM '+SCHEMA+'.fictional WHERE deleted=false'
  );

  test('baseline: fictional SQL row and separate localhost HTTP endpoint both reachable',async()=>{
    const v=(await owner.query("SELECT current_database() AS db, current_setting('server_version_num')::int AS version")).rows[0];
    assert.equal(v.db,'gdpr_outbox_worker_ci');
    assert.equal(Math.floor(v.version/10000),17);
    await owner.query('CREATE ROLE '+ROLE+" LOGIN PASSWORD 'synthetic-two-plane-only' NOBYPASSRLS NOSUPERUSER");
    await owner.query('CREATE SCHEMA '+SCHEMA);
    await owner.query('REVOKE ALL ON SCHEMA '+SCHEMA+' FROM PUBLIC');
    await owner.query('CREATE TABLE '+SCHEMA+'.fictional(id text PRIMARY KEY, deleted boolean NOT NULL)');
    await owner.query("INSERT INTO "+SCHEMA+".fictional VALUES ('made-up-alice',false)");
    await owner.query('GRANT USAGE ON SCHEMA '+SCHEMA+' TO '+ROLE);
    await owner.query('GRANT SELECT ON '+SCHEMA+'.fictional TO '+ROLE);

    sqlClient=new Client(runtimeCredentials);
    sqlClient.on('error',()=>{}); // Expected after PG backend termination in later test.
    await sqlClient.connect();
    server=http.createServer((req,res)=>{
      res.setHeader('Content-Type','application/json');
      if(!httpPlaneOpen){
        res.writeHead(503);
        res.end(JSON.stringify({status:'quarantined',synthetic:true}));
        return;
      }
      if(req.url!=='/fictional-subject'){
        res.writeHead(404);
        res.end(JSON.stringify({error:'not_found'}));
        return;
      }
      res.writeHead(200);
      res.end(JSON.stringify({synthetic:true,id:'made-up-alice',deleted:false}));
    });
    await new Promise((resolve,reject)=>{
      server.once('error',reject);
      server.listen(0,'127.0.0.1',resolve);
    });
    port=server.address().port;
    assert.equal((await querySql()).rows[0].n,1);
    assert.equal((await readHttp()).status,200);
  });

  test('closing only the HTTP plane leaves PostgreSQL data directly readable',async()=>{
    httpPlaneOpen=false;
    assert.equal((await readHttp()).status,503);
    assert.equal((await querySql()).rows[0].n,1,
      'SQL read survives a completely independent HTTP denial');
    httpPlaneOpen=true;
  });

  test('NOLOGIN blocks fresh SQL login but not an established SQL session or HTTP',async()=>{
    await owner.query('ALTER ROLE '+ROLE+' NOLOGIN PASSWORD NULL');
    const newClient=new Client(runtimeCredentials);
    try{
      await assert.rejects(newClient.connect(),
        /not permitted to log in|password authentication failed/i);
    }finally{
      await newClient.end().catch(()=>{});
    }
    assert.equal((await querySql()).rows[0].n,1,
      'an already authenticated SQL session survives NOLOGIN');
    assert.equal((await readHttp()).status,200,
      'Postgres role restrictions do not disable a separate HTTPS API');
  });

  test('toy two-plane quarantine denies HTTP and drains the existing SQL connection',async()=>{
    httpPlaneOpen=false;
    const pid=(await sqlClient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
    const killed=(await owner.query('SELECT pg_terminate_backend($1::int) AS killed',[pid])).rows[0].killed;
    assert.equal(killed,true);
    await assert.rejects(querySql(),/terminat|not queryable|connection error|closed|ending/i);
    const count=(await owner.query(
      'SELECT COUNT(*)::int AS n FROM pg_stat_activity WHERE usename=$1',[ROLE]
    )).rows[0].n;
    assert.equal(count,0);
    const httpResult=await readHttp();
    assert.deepEqual(httpResult,{
      status:503,body:{status:'quarantined',synthetic:true}
    });
    // These are CI-only mechanisms; a whole-cluster restore could re-enable
    // a PostgreSQL role, and external provider endpoints need other controls.
  });

  test.after(async()=>{
    try{
      if(sqlClient)await sqlClient.end().catch(()=>{});
      if(server){
        server.closeAllConnections();
        await new Promise(resolve=>server.close(()=>resolve()));
      }
    }finally{
      try{await owner.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE');}
      finally{
        try{await owner.query('DROP ROLE IF EXISTS '+ROLE);}
        finally{await owner.end();}
      }
    }
  });
}
