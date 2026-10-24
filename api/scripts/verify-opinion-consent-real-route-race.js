'use strict';

/**
 * CI-ONLY PostgreSQL 17 integration of the ACTUAL DEMOS POST opinion route.
 * Routes are loaded from production source with mocked authentication/push,
 * but queries execute against throwaway local synthetic PostgreSQL tables.
 * Revocation is an independent SQL transaction with the same users-first
 * lock ordering as DEMOS PUT /revoke. The real PUT route is NOT executed here.
 * No Supabase endpoint, persistent database, real JWT or personal data.
 */
const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
const express=require('express');
const {Pool,Client}=require('pg');

const DB='opinion_bitset_ci';
const SCHEMA='ci_opinion_actual_route_247';
const ACCOUNTS=['synthetic-revoke-first','synthetic-save-first',
  'synthetic-rollback','synthetic-other'];
const CLIENT_APP='ci_opinion_actual_post_247';
const GATE_A=2470099,GATE_B=1;
const AUTH=path.resolve(__dirname,'../middleware/auth.js');
const NOTIFICATIONS=path.resolve(__dirname,'../services/politicalOpinionNotificationService.js');
const PUSH=path.resolve(__dirname,'../services/currentSupporterPushService.js');
const ROUTE=path.resolve(__dirname,'../routes/opinioni/user-answers.js');

function guard() {
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.OPINION_BENCH_EPHEMERAL!=='yes'||
      e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
      e.PGDATABASE!==DB||e.PGUSER!=='postgres'||
      e.PGPASSWORD!=='synthetic-only') {
    throw Error('Refusing live route test outside disposable GitHub Actions PostgreSQL');
  }
}
const pgconfig=app=>({
  host:'127.0.0.1',port:5432,database:DB,user:'postgres',
  password:'synthetic-only',statement_timeout:14000,application_name:app,
  options:'-c search_path='+SCHEMA+',public'
});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function untilBlocked(observer,waitingApp,blockerPid,label) {
  const deadline=Date.now()+10000;
  while(Date.now()<deadline) {
    const r=await observer.query('SELECT pid,pg_blocking_pids(pid) AS blockers '+
      'FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type=$2',
      [waitingApp,'Lock']);
    const found=r.rows.find(row=>row.blockers.includes(blockerPid));
    if(found)return found.pid;
    await pause(20);
  }
  throw new Error('Expected PostgreSQL lock wait not observed: '+label);
}
async function queryWithTimeout(task,label,ms=11000) {
  let timer;
  return Promise.race([task,new Promise((_,reject)=>{
    timer=setTimeout(()=>reject(new Error('Timed out '+label)),ms);
  })]).finally(()=>clearTimeout(timer));
}
function envelopeId(account) {
  assert.ok(ACCOUNTS.includes(account));
  return account;
}
async function createFixture(admin) {
  const identity=await admin.query('SELECT current_database() db,current_user::text actor');
  assert.deepEqual(identity.rows,[{db:DB,actor:'postgres'}]);
  await admin.query('CREATE SCHEMA '+SCHEMA);
  await admin.query('CREATE TABLE '+SCHEMA+
    '.users (id text PRIMARY KEY,political_opinions_consent boolean NOT NULL)');
  await admin.query('CREATE TABLE '+SCHEMA+
    '.user_consents (user_id text PRIMARY KEY REFERENCES '+SCHEMA+
    '.users(id),political_opinions_consent boolean NOT NULL)');
  await admin.query('CREATE TABLE '+SCHEMA+
    '.opinioni_risposte (user_id text PRIMARY KEY REFERENCES '+SCHEMA+
    ".users(id),caccia text,nato text)");
  await admin.query('CREATE FUNCTION '+SCHEMA+'.hold_opinion_upsert() '+
    'RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN '+
    'PERFORM pg_advisory_xact_lock('+GATE_A+','+GATE_B+'); '+
    'RETURN NEW; END; $$');
  await admin.query('CREATE TRIGGER hold_opinion_upsert '+
    'BEFORE INSERT OR UPDATE ON '+SCHEMA+'.opinioni_risposte '+
    'FOR EACH ROW EXECUTE FUNCTION '+SCHEMA+'.hold_opinion_upsert()');
  for(const account of ACCOUNTS) {
    await admin.query('INSERT INTO '+SCHEMA+
      '.users(id,political_opinions_consent) VALUES($1,true)',[account]);
    await admin.query('INSERT INTO '+SCHEMA+
      '.user_consents(user_id,political_opinions_consent) VALUES($1,true)',
      [account]);
  }
  await admin.query('INSERT INTO '+SCHEMA+
    '.opinioni_risposte(user_id,caccia) VALUES($1,$2),($3,$4)',
    [ACCOUNTS[0],'c',ACCOUNTS[2],'c']);
}

async function loadActualRoute(realPool) {
  const originals=new Map();
  for(const file of [AUTH,NOTIFICATIONS,PUSH,ROUTE]){
    originals.set(file,require.cache[file]);
  }
  const fake=(file,exports)=>{require.cache[file]={
    id:file,filename:file,loaded:true,exports
  };};
  fake(AUTH,{
    pool:realPool,
    verifyToken(req,res,next){
      const auth=req.get('authorization');
      const account=auth?.startsWith('Bearer ')?auth.slice(7):null;
      if(!ACCOUNTS.includes(account)){
        return res.status(401).json({success:false,error:'Autenticazione richiesta'});
      }
      req.userId=account;
      req.user={id:account,isAdmin:false,isPolitician:false,isCandidate:false};
      next();
    },
    requireAdmin:(_req,res)=>res.status(403).end()
  });
  fake(NOTIFICATIONS,{createSupporterOpinionNotifications:async()=>({created:0})});
  fake(PUSH,{sendPushToCurrentSupporters:async()=>0});
  delete require.cache[ROUTE];
  try{
    const router=require(ROUTE);
    const app=express();
    app.disable('x-powered-by');
    app.use(express.json({limit:'12kb'}));
    app.use('/api/opinioni',router);
    return {app,restore(){
      for(const [file,original] of originals){
        if(original)require.cache[file]=original;
        else delete require.cache[file];
      }
    }};
  }catch(e){
    for(const [file,original] of originals){
      if(original)require.cache[file]=original;
      else delete require.cache[file];
    }
    throw e;
  }
}
async function post(base,account,value) {
  const response=await fetch(base+'/api/opinioni/salva',{
    method:'POST',headers:{authorization:'Bearer '+envelopeId(account),
      'content-type':'application/json'},
    body:JSON.stringify({opinioni:{caccia:value}})
  });
  return {status:response.status,body:await response.json()};
}
async function revokeTransaction(client,account,{commit=true}={}) {
  await client.query('BEGIN');
  await client.query('UPDATE '+SCHEMA+
    '.users SET political_opinions_consent=false WHERE id=$1',[account]);
  await client.query('UPDATE '+SCHEMA+
    '.user_consents SET political_opinions_consent=false WHERE user_id=$1',
    [account]);
  await client.query('DELETE FROM '+SCHEMA+
    '.opinioni_risposte WHERE user_id=$1',[account]);
  await client.query(commit?'COMMIT':'ROLLBACK');
}
async function status(admin,account) {
  const u=await admin.query('SELECT u.political_opinions_consent user_consent,'+
    'uc.political_opinions_consent consent_row,r.caccia vote FROM '+SCHEMA+
    '.users u JOIN '+SCHEMA+'.user_consents uc ON uc.user_id=u.id '+
    'LEFT JOIN '+SCHEMA+'.opinioni_risposte r ON r.user_id=u.id '+
    'WHERE u.id=$1',[account]);
  return u.rows[0];
}
async function main(){
  guard();
  const admin=new Client(pgconfig('ci_opinion_observer_247'));
  const revoker=new Client(pgconfig('ci_opinion_revoker_247'));
  const gate=new Client(pgconfig('ci_opinion_gate_247'));
  const actualPool=new Pool({...pgconfig(CLIENT_APP),max:5});
  let mounted,server;
  try{
    await Promise.all([admin.connect(),revoker.connect(),gate.connect()]);
    await createFixture(admin);
    mounted=await loadActualRoute(actualPool);
    server=http.createServer(mounted.app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const revokePid=(await revoker.query('SELECT pg_backend_pid() pid')).rows[0].pid;
    let verifiedWaits=0,revokedBeforeSave=0,savedBeforeRevoked=0,rollbackRecovered=0;

    // Revoke-first: hold the real users row update open while the ACTUAL
    // Express POST has completed its optimistic preflight and waits for
    // SELECT id FROM users FOR UPDATE. Commit revoke and verify HTTP 403.
    const account=ACCOUNTS[0];
    await revoker.query('BEGIN');
    await revoker.query('UPDATE '+SCHEMA+
      '.users SET political_opinions_consent=false WHERE id=$1',[account]);
    await revoker.query('UPDATE '+SCHEMA+
      '.user_consents SET political_opinions_consent=false WHERE user_id=$1',[account]);
    await revoker.query('DELETE FROM '+SCHEMA+
      '.opinioni_risposte WHERE user_id=$1',[account]);
    let pending=post(base,account,'f');
    try{
      await untilBlocked(admin,CLIENT_APP,revokePid,'actual POST waits revoke');
      verifiedWaits++;
    }finally{
      await revoker.query('COMMIT');
    }
    assert.equal((await queryWithTimeout(pending,'revoke-first actual POST')).status,403);
    assert.deepEqual(await status(admin,account),{
      user_consent:false,consent_row:false,vote:null
    });
    revokedBeforeSave++;

    // Save-first: force the ACTUAL route to pause at its INSERT trigger
    // *after* it took the users row lock. The competing SQL revocation
    // blocks on that row; once the gate is released the POST commits,
    // and the revocation then deletes its vote in the same transaction.
    const first=ACCOUNTS[1];
    await gate.query('SELECT pg_advisory_lock($1,$2)',[GATE_A,GATE_B]);
    let save=post(base,first,'i');
    let savePid;
    let gateHeld=true;
    try{
      const gatePid=(await gate.query('SELECT pg_backend_pid() pid')).rows[0].pid;
      savePid=await untilBlocked(admin,CLIENT_APP,gatePid,
        'actual POST pauses after consent lock');
      const tx=async()=>revokeTransaction(revoker,first);
      const revoking=tx();
      try {
        await untilBlocked(admin,'ci_opinion_revoker_247',savePid,
          'revocation waits actual POST');
        verifiedWaits++;
      }finally{
        await gate.query('SELECT pg_advisory_unlock($1,$2)',[GATE_A,GATE_B]);
        gateHeld=false;
      }
      const [saved,revoked]=await Promise.all([
        queryWithTimeout(save,'save-first actual POST'),
        queryWithTimeout(revoking,'save-first revocation')
      ]);
      assert.equal(saved.status,200);
      assert.equal(saved.body.savedCount,1);
      assert.equal(revoked,undefined);
    } finally {
      if(gateHeld)await gate.query('SELECT pg_advisory_unlock($1,$2)',[GATE_A,GATE_B]);
    }
    assert.deepEqual(await status(admin,first),{
      user_consent:false,consent_row:false,vote:null
    });
    savedBeforeRevoked++;

    // A revoke that rolls back must release the row lock and preserve
    // the previous consent and vote. The blocked ACTUAL POST can save.
    const rolled=ACCOUNTS[2];
    await revoker.query('BEGIN');
    await revoker.query('UPDATE '+SCHEMA+
      '.users SET political_opinions_consent=false WHERE id=$1',[rolled]);
    await revoker.query('UPDATE '+SCHEMA+
      '.user_consents SET political_opinions_consent=false WHERE user_id=$1',[rolled]);
    await revoker.query('DELETE FROM '+SCHEMA+
      '.opinioni_risposte WHERE user_id=$1',[rolled]);
    pending=post(base,rolled,'f');
    try {
      await untilBlocked(admin,CLIENT_APP,revokePid,'actual POST waits failing revoke');
      verifiedWaits++;
    }finally{
      await revoker.query('ROLLBACK');
    }
    const afterRollback=await queryWithTimeout(pending,'rollback actual POST');
    assert.equal(afterRollback.status,200);
    assert.deepEqual(await status(admin,rolled),{
      user_consent:true,consent_row:true,vote:'f'
    });
    rollbackRecovered++;

    assert.deepEqual(await status(admin,ACCOUNTS[3]),{
      user_consent:true,consent_row:true,vote:null
    });
    assert.equal((await post(base,first,'f')).status,403);
    assert.equal((await post(base,account,'f')).status,403);

    console.log('OPINION_REAL_ROUTE_CONSENT_RACE_PASS');
    console.log('OPINION_REAL_ROUTE_CONSENT_RACE_RESULT_JSON='+JSON.stringify({
      source:'api/routes/opinioni/user-answers.js',postgres:17,
      revokedBeforeSave,savedBeforeRevoked,rollbackRecovered,
      verifiedWaits,deletedVotesNotRecreated:true,
      livePostRouteUsed:true,
      revokeRouteUsed:false,
      syntheticRevocationSQLUsesSameUsersFirstLockOrder:true,
      realSupabaseAccess:false,
      note:'Real POST route with fake JWT and throwaway PostgreSQL; no live deployment'
    }));
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    mounted?.restore();
    await actualPool.end();
    for(const client of [revoker,gate,admin]){
      try{await client.end();}catch(_err){}
    }
  }
}
main().catch(err=>{console.error('Real POST route consent race CI FAILED:',err);process.exitCode=1;});
