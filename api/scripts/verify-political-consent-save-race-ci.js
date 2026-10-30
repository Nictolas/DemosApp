'use strict';

/**
 * Synthetic-only PostgreSQL 17 / real Express routes concurrency test.
 * Verifies consent revoke and opinion save serialize on users.id.
 * Never connects to production, Supabase or Render.
 */
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const {Pool} = require('pg');

const DB = 'political_consent_race_ci';
const ID = '00000000-0000-4000-8000-000000000125';
const gate = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return {promise, resolve};
};
const baseEnv = process.env;
function guard(){
  const e=baseEnv;
  if (e.GITHUB_ACTIONS !== 'true' || e.POLITICAL_CONSENT_RACE_CI !== 'synthetic' ||
      e.PGHOST !== '127.0.0.1' || e.PGPORT !== '5432' ||
      e.PGDATABASE !== DB || e.PGUSER !== 'postgres' ||
      e.PGPASSWORD !== 'synthetic-only' ||
      e.DATABASE_URL || e.SUPABASE_URL || e.RENDER || e.SUPABASE_DB_URL ||
      e.SUPABASE_SERVICE_ROLE_KEY) {
    throw Error('Refuse any non-local synthetic Postgres');
  }
}
function sourceSql(s) { return String(s).replace(/\s+/g,' ').trim(); }
function timeout(p, ms=9000){
  return Promise.race([p,new Promise((_,reject)=>
    setTimeout(()=>reject(Error('Synthetic concurrency lock timed out')),ms))]);
}

async function main(){
  guard();
  const real=new Pool({
    host:'127.0.0.1',port:5432,database:DB,user:'postgres',
    password:'synthetic-only',max:3,statement_timeout:8000,
    connectionTimeoutMillis:3500,application_name:'synthetic_consent_race'
  });
  const paths=[
    require.resolve('../middleware/auth'),
    require.resolve('../services/auditService'),
    require.resolve('../services/privacyErasureLedgerService'),
    require.resolve('../services/politicalConsentService'),
    require.resolve('../routes/opinioni/user-answers'),
    require.resolve('../routes/user/political-opinions-consent'),
    require.resolve('../routes/users/profile')
  ];
  const previous=new Map(paths.map(p=>[p,require.cache[p]]));
  let server;
  let blocked=null;
  const pool={
    query:(...args)=>real.query(...args),
    async connect(){
      const c=await real.connect();
      return {
        async query(sql,params){
          const normalized=sourceSql(sql);
          // The second HTTP request must reach its competing DB statement
          // BEFORE the first transaction is released. Otherwise a green
          // result could merely prove sequential requests.
          if(blocked && !blocked.contenderSeen && (
            (blocked.phase==='save' && normalized.startsWith('UPDATE users SET political_opinions_consent = false')) ||
            (blocked.phase==='revoke' && /^SELECT id FROM users WHERE id = \$1 FOR UPDATE$/.test(normalized))
          )){
            blocked.contenderSeen=true;
            blocked.contender.resolve();
          }
          const answer=await c.query(sql,params);
          if(blocked && !blocked.consumed && (
            (blocked.phase==='save' && /^SELECT id FROM users WHERE id = \$1 FOR UPDATE$/.test(normalized)) ||
            (blocked.phase==='revoke' && normalized.startsWith('UPDATE users SET political_opinions_consent = false'))
          )){
            blocked.consumed=true;
            blocked.locked.resolve();
            await timeout(blocked.resume.promise);
          }
          return answer;
        },
        release(destroy){ c.release(destroy); }
      };
    }
  };
  try{
    const v=(await real.query("SELECT current_database() db,current_setting('server_version_num')::int v")).rows[0];
    assert.equal(v.db,DB);
    assert.equal(Math.floor(v.v/10000),17);
    await real.query('CREATE TABLE users(id uuid PRIMARY KEY, political_opinions_consent boolean NOT NULL, political_opinions_consent_timestamp timestamptz, political_opinions_consent_ip_address text, political_opinions_consent_user_agent text, updated_at timestamptz DEFAULT now())');
    await real.query('CREATE TABLE user_consents(user_id uuid PRIMARY KEY,political_opinions_consent boolean,political_opinions_consent_timestamp timestamptz,political_opinions_consent_ip_address text,political_opinions_consent_user_agent text,updated_at timestamptz DEFAULT now())');
    await real.query('CREATE TABLE opinioni_risposte(user_id uuid PRIMARY KEY,energia_nucleare text)');
    await real.query('CREATE TABLE opinioni_domande(id text PRIMARY KEY,text text)');
    await real.query("INSERT INTO opinioni_domande VALUES('energia_nucleare','Synthetic energy opinion')");
    await real.query('INSERT INTO users(id,political_opinions_consent) VALUES($1,true)',[ID]);
    await real.query('INSERT INTO user_consents(user_id,political_opinions_consent) VALUES($1,true)',[ID]);

    const [auth,audit,ledger,service,saveRoute,revokeRoute,adminRoute]=paths;
    require.cache[auth]={id:auth,filename:auth,loaded:true,exports:{
      pool,
      verifyToken:(req,res,next)=>{
        if(req.get('authorization')!=='Bearer synthetic-test'){
          return res.status(401).json({success:false});
        }
        req.userId=ID;req.user={id:ID,isPolitician:false,isCandidate:false};
        next();
      },
      requireAdmin:(_r,_res,next)=>next() // CI-only fake administrator
    }};
    require.cache[audit]={id:audit,filename:audit,loaded:true,exports:{
      logAction:async()=>{}
    }};
    require.cache[ledger]={id:ledger,filename:ledger,loaded:true,exports:{
      EVENT_TYPES:{POLITICAL_CONSENT_GRANTED:'political_consent_granted',
        POLITICAL_CONSENT_REVOKED:'political_consent_revoked'},
      recordEvent:async()=>{},
      async deleteByAnyColumn(db,table,_cols,user){
        if(table==='opinioni_risposte'){
          const r=await db.query('DELETE FROM opinioni_risposte WHERE user_id=$1',[user]);
          return r.rowCount;
        }
        return 0;
      },
      tableHasColumn:async()=>false,
      quoteIdentifier:id=>'"'+String(id).replace(/"/g,'""')+'"'
    }};
    for(const p of [service,saveRoute,revokeRoute,adminRoute])delete require.cache[p];

    const app=express();app.disable('x-powered-by');app.use(express.json());
    app.use('/api/opinioni',require(saveRoute));
    app.use('/api/user/political-opinions-consent',require(revokeRoute));
    app.use('/api/users',require(adminRoute));
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const request=(path,method,body)=>fetch(base+path,{
      method,headers:{authorization:'Bearer synthetic-test','content-type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)
    });
    const save=()=>request('/api/opinioni/salva','POST',{opinioni:{energia_nucleare:'f'}});
    const revoke=()=>request('/api/user/political-opinions-consent/revoke','PUT');
    const admin=()=>request('/api/users/'+ID+'/opinioni','PUT',{opinioni:{energia_nucleare:'f'}});
    const reset=async()=>{
      await real.query('UPDATE users SET political_opinions_consent=true WHERE id=$1',[ID]);
      await real.query('UPDATE user_consents SET political_opinions_consent=true WHERE user_id=$1',[ID]);
      await real.query('DELETE FROM opinioni_risposte WHERE user_id=$1',[ID]);
    };
    const inspect=async()=>{
      const rows=await real.query('SELECT u.political_opinions_consent consent, uc.political_opinions_consent override, orr.energia_nucleare answer FROM users u JOIN user_consents uc ON uc.user_id=u.id LEFT JOIN opinioni_risposte orr ON orr.user_id=u.id WHERE u.id=$1',[ID]);
      return rows.rows[0];
    };

    // SAVE first: revocation must WAIT for save's row lock, then delete
    // the newly written answer atomically before returning HTTP 200.
    blocked={phase:'save',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const saveFirst=save();
    await timeout(blocked.locked.promise);
    const revokeSecond=revoke();
    await timeout(blocked.contender.promise);
    // The revocation has reached the conflicting database UPDATE while
    // the opinion-save transaction still owns the users row lock.
    blocked.resume.resolve();
    assert.equal((await timeout(saveFirst)).status,200);
    assert.equal((await timeout(revokeSecond)).status,200);
    assert.deepEqual(await inspect(),{consent:false,override:false,answer:null});

    // REVOKE first: hold the users row lock, then save must wait, notice
    // consent false, issue rollback and refuse to create a new answer.
    await reset();
    blocked={phase:'revoke',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const revokeFirst=revoke();
    await timeout(blocked.locked.promise);
    const saveSecond=save();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(revokeFirst)).status,200);
    const saveResponse=await timeout(saveSecond);
    assert.equal(saveResponse.status,403);
    assert.equal((await saveResponse.json()).consent_required,true);
    assert.deepEqual(await inspect(),{consent:false,override:false,answer:null});

    // A normal request should still be allowed after a new explicit grant.
    await reset();
    blocked=null;
    assert.equal((await save()).status,200);
    assert.deepEqual(await inspect(),{consent:true,override:true,answer:'f'});
    // The admin route must observe the same serialization guarantees.
    await reset();
    blocked={phase:'save',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const adminFirst=admin();
    await timeout(blocked.locked.promise);
    const afterAdminRevoke=revoke();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(adminFirst)).status,200);
    assert.equal((await timeout(afterAdminRevoke)).status,200);
    assert.deepEqual(await inspect(),{consent:false,override:false,answer:null});

    await reset();
    blocked={phase:'revoke',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const revokeBeforeAdmin=revoke();
    await timeout(blocked.locked.promise);
    const adminAfterRevoke=admin();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(revokeBeforeAdmin)).status,200);
    const adminDenied=await timeout(adminAfterRevoke);
    assert.equal(adminDenied.status,403);
    assert.equal((await adminDenied.json()).consent_required,true);
    assert.deepEqual(await inspect(),{consent:false,override:false,answer:null});

    console.log('POLITICAL_CONSENT_SAVE_REVOKE_REAL_PG17_PASS');
    console.log('POLITICAL_CONSENT_SAVE_REVOKE_RESULT_JSON='+JSON.stringify({
      postgres:17,fixture:'synthetic-only',cases:['save-before-revoke','revoke-before-save','grant-and-save','admin-before-revoke','revoke-before-admin'],
      postRevocationPersistedAnswers:0, unauthorizedWrites:0,
      isolated:true,productionUntouched:true
    }));
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    for(const [p,original] of previous){
      if(original)require.cache[p]=original;else delete require.cache[p];
    }
    await real.end();
  }
}
main().catch(e=>{console.error('SYNTHETIC_CONSENT_RACE_FAIL',e);process.exitCode=1;});
