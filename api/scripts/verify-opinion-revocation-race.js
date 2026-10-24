'use strict';

/**
 * CI-ONLY controlled race with synthetic political-consent and BYTEA votes.
 * Never import in DEMOS routes. All writable SQL stays in a disposable
 * GitHub Actions PostgreSQL 17 service, with hard-coded dummy identities.
 *
 * The deliberately UNSAFE flow is a negative control: consent read before
 * the write transaction can resurrect votes after a committed revocation.
 * Protected flow locks the consent row inside the same write transaction.
 * This does not verify the actual production consent route, RLS or Android.
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const {Pool} = require('pg');
const {createCatalogRegistry,encodeEnvelope,decodeEnvelope} =
  require('../utils/opinionCodecEnvelope');

const DB='opinion_bitset_ci';
const SCHEMA='ci_opinion_revoke_race_247';
const CONSENT=SCHEMA+'.consent';
const VOTES=SCHEMA+'.votes';
const FORMATS=['fixed','trimmed','sparse'];
const IDS=['synthetic_alpha','synthetic_beta'];
const REGISTRY=createCatalogRegistry([{version:1,ids:IDS}]);
const ALLOWED=new Set(FORMATS.flatMap(fmt=>[
  'synthetic-unsafe-'+fmt,
  'synthetic-savefirst-'+fmt,
  'synthetic-revokefirst-'+fmt,
  'synthetic-rollback-'+fmt
]));

function guard() {
  const env=process.env;
  if(env.GITHUB_ACTIONS!=='true' ||
      env.OPINION_BENCH_EPHEMERAL!=='yes' ||
      env.PGHOST!=='127.0.0.1' ||
      env.PGPORT!=='5432' ||
      env.PGDATABASE!==DB ||
      env.PGUSER!=='postgres' ||
      env.PGPASSWORD!=='synthetic-only') {
    throw new Error('Revocation race probe requires ephemeral GitHub Actions PostgreSQL only');
  }
}
function pool() {
  return new Pool({host:'127.0.0.1',port:5432,database:DB,user:'postgres',
    password:'synthetic-only',max:9,statement_timeout:12000,
    application_name:'ci_opinion_revocation_race_only'});
}
function deferred() {
  let resolve;
  const promise=new Promise(r=>{resolve=r;});
  return {promise,resolve};
}
function barrier() {
  const reached=deferred(),open=deferred();
  return {
    reached:reached.promise,
    release:()=>open.resolve(),
    async pause() {
      reached.resolve();
      await open.promise;
    }
  };
}
function timeout(p,label,ms=8500) {
  let timer;
  return Promise.race([
    p,
    new Promise((_,reject)=>{
      timer=setTimeout(()=>reject(new Error('Timed out '+label)),ms);
    })
  ]).finally(()=>clearTimeout(timer));
}
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForBlocked(pool,waitingPid,holdingPid,label) {
  const deadline=Date.now()+8000;
  while(Date.now()<deadline) {
    const r=await pool.query('SELECT pg_blocking_pids($1::integer) AS blockers',
      [waitingPid]);
    if(r.rows[0].blockers.includes(holdingPid)) return;
    await sleep(15);
  }
  throw new Error('Timed out '+label);
}
async function waitForPid(pids,account,kind) {
  const deadline=Date.now()+8000;
  while(Date.now()<deadline) {
    if(pids.get(account)?.[kind]) return;
    await sleep(10);
  }
  throw new Error('Timed out '+kind+' backend pid for '+account);
}
async function fixture(db) {
  const id=await db.query('SELECT current_database() AS db, current_user::text AS actor');
  assert.deepEqual(id.rows,[{db:DB,actor:'postgres'}]);
  await db.query('CREATE SCHEMA '+SCHEMA);
  await db.query('CREATE TABLE '+CONSENT+
    ' (subject text PRIMARY KEY, granted boolean NOT NULL)');
  await db.query('CREATE TABLE '+VOTES+
    ' (subject text PRIMARY KEY REFERENCES '+CONSENT+'(subject), '+
    'catalog_version integer NOT NULL, encoding text NOT NULL, '+
    'catalog_fingerprint text NOT NULL, payload bytea NOT NULL)');
  for (const account of ALLOWED) {
    await db.query('INSERT INTO '+CONSENT+'(subject,granted) VALUES ($1,true)',
      [account]);
  }
}
async function stored(db,account) {
  const r=await db.query('SELECT subject,catalog_version,encoding,'+
    'catalog_fingerprint,payload FROM '+VOTES+' WHERE subject=$1',[account]);
  return r.rows[0]??null;
}
async function consent(db,account) {
  const r=await db.query('SELECT granted FROM '+CONSENT+' WHERE subject=$1',
    [account]);
  return r.rows[0]?.granted;
}
function envelope(row) {
  return {schemaVersion:1,catalogVersion:row.catalog_version,
    catalogFingerprint:row.catalog_fingerprint,encoding:row.encoding,
    payload:row.payload};
}
function mount(db) {
  const app=express();
  app.disable('x-powered-by');
  app.use(express.json({limit:'8kb'}));
  const hooks={
    unsafeChecked:new Map(),
    saveLocked:new Map(),
    revokeUpdated:new Map()
  };
  const pids=new Map();
  const stamps=new Map();
  const notePid=(account,kind,pid)=>{
    if(!pids.has(account))pids.set(account,{});
    pids.get(account)[kind]=pid;
  };
  const appRoutes=express.Router();
  appRoutes.use((req,res,next)=>{
    const token=req.get('authorization');
    const account=token?.startsWith('Bearer ')?token.slice(7):null;
    if(!ALLOWED.has(account)) {
      return res.status(401).json({success:false,error:'Autenticazione richiesta'});
    }
    req.account=account;
    next();
  });

  appRoutes.post('/opinioni/salva',async(req,res)=>{
    const account=req.account;
    const unsafe=req.query.mode==='unsafe';
    const selected=req.body?.opinioni||req.body;
    if(!selected || typeof selected!=='object' ||
        !['f','c','i'].includes(selected.synthetic_alpha)) {
      return res.status(400).json({success:false,error:'Opinione non valida'});
    }
    const format=account.split('-').at(-1);
    let dbClient=null,tx=false;
    try {
      if(unsafe) {
        // Deliberately mirrors the dangerous check-before-transaction shape;
        // it is NOT a recommended implementation or a production endpoint.
        if(!await consent(db,account)) {
          return res.status(403).json({success:false,error:'Consenso richiesto'});
        }
        await hooks.unsafeChecked.get(account)?.pause();
      }
      dbClient=await db.connect();
      await dbClient.query('BEGIN');tx=true;
      const pid=(await dbClient.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      notePid(account,'save',pid);
      if(!unsafe) {
        const lock=await dbClient.query('SELECT granted FROM '+CONSENT+
          ' WHERE subject=$1 FOR UPDATE',[account]);
        if(lock.rows[0]?.granted!==true) {
          await dbClient.query('ROLLBACK');tx=false;
          return res.status(403).json({success:false,error:'Consenso richiesto'});
        }
        await hooks.saveLocked.get(account)?.pause();
      }
      const previous=await stored(dbClient,account);
      const answers=previous?decodeEnvelope(REGISTRY,envelope(previous)):{};
      const binary=encodeEnvelope(REGISTRY,{version:1,encoding:format,
        answers:{...answers,synthetic_alpha:selected.synthetic_alpha}});
      await dbClient.query('INSERT INTO '+VOTES+
        ' (subject,catalog_version,encoding,catalog_fingerprint,payload) '+
        ' VALUES ($1,$2,$3,$4,$5) ON CONFLICT (subject) DO UPDATE SET '+
        ' catalog_version=EXCLUDED.catalog_version,'+
        ' encoding=EXCLUDED.encoding,'+
        ' catalog_fingerprint=EXCLUDED.catalog_fingerprint,'+
        ' payload=EXCLUDED.payload',[
          account,binary.catalogVersion,binary.encoding,
          binary.catalogFingerprint,binary.payload
        ]);
      await dbClient.query('COMMIT');tx=false;
      stamps.set(account,(stamps.get(account)||0)+1);
      return res.json({success:true,savedCount:1});
    } catch(e) {
      if(tx)await dbClient.query('ROLLBACK');
      return res.status(500).json({success:false,error:'Errore interno'});
    } finally {
      dbClient?.release();
    }
  });

  appRoutes.put('/consent/revoke',async(req,res)=>{
    const account=req.account;
    const conn=await db.connect();
    let tx=false;
    try {
      await conn.query('BEGIN');tx=true;
      const pid=(await conn.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
      notePid(account,'revoke',pid);
      const changed=await conn.query('UPDATE '+CONSENT+
        ' SET granted=false WHERE subject=$1 RETURNING subject',[account]);
      assert.equal(changed.rowCount,1);
      await hooks.revokeUpdated.get(account)?.pause();
      await conn.query('DELETE FROM '+VOTES+' WHERE subject=$1',[account]);
      if(req.query.fail==='yes')throw new Error('Simulated revoke cleanup failure');
      await conn.query('COMMIT');tx=false;
      return res.json({success:true,consent:{granted:false}});
    } catch(e) {
      if(tx)await conn.query('ROLLBACK');
      return res.status(500).json({success:false,error:'Errore revoca'});
    } finally {
      conn.release();
    }
  });

  appRoutes.get('/opinioni-list',async(req,res)=>{
    res.set('Cache-Control','private, no-store');
    const account=req.account;
    const row=await stored(db,account);
    const votes=row?decodeEnvelope(REGISTRY,envelope(row)):{};
    return res.json({success:true,data:IDS.map(id=>({
      id,userAnswer:votes[id]??null
    }))});
  });
  app.use('/_ci/api',appRoutes);
  return {app,hooks,pids,stamps};
}
async function httpRequest(base,method,path,account,body) {
  const response=await fetch(base+'/_ci/api'+path,{
    method,
    headers:{authorization:'Bearer '+account,
      ...(body?{'content-type':'application/json'}:{})},
    ...(body?{body:JSON.stringify(body)}:{})
  });
  return {status:response.status,body:await response.json()};
}

async function main() {
  guard();
  const db=pool();
  let server;
  const counters={
    negativeControlResurrections:0,
    saveFirstRevocations:0,
    revokeFirstDeniedSaves:0,
    rollbackRestoresConsent:0,
    verifiedLockWaits:0
  };
  try {
    await fixture(db);
    const {app,hooks,pids}=mount(db);
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const post=(account)=>httpRequest(base,'POST','/opinioni/salva',account,
      {opinioni:{synthetic_alpha:'f'}});
    const revoke=(account,fail=false)=>httpRequest(base,'PUT',
      '/consent/revoke'+(fail?'?fail=yes':''),account);
    const read=(account)=>httpRequest(base,'GET','/opinioni-list',account);

    for(const format of FORMATS) {
      // NEGATIVE CONTROL: a consent read done before a transaction can be
      // overtaken by revocation and recreate a supposedly erased BYTEA row.
      const unsafe='synthetic-unsafe-'+format;
      const paused=barrier();
      hooks.unsafeChecked.set(unsafe,paused);
      const lateSave=httpRequest(base,'POST','/opinioni/salva?mode=unsafe',
        unsafe,{opinioni:{synthetic_alpha:'f'}});
      try {
        await timeout(paused.reached,'unsafe consent check');
        const revoked=await revoke(unsafe);
        assert.equal(revoked.status,200);
        assert.equal(await consent(db,unsafe),false);
        assert.equal(await stored(db,unsafe),null);
      } finally {
        paused.release();
      }
      const unsafeResult=await timeout(lateSave,'unsafe late HTTP save');
      assert.equal(unsafeResult.status,200);
      assert.ok(await stored(db,unsafe),'Negative control must reproduce resurrection');
      assert.equal((await read(unsafe)).body.data[0].userAnswer,'f');
      counters.negativeControlResurrections++;
      // Clean up the deliberately resurrected dummy record.
      await db.query('DELETE FROM '+VOTES+' WHERE subject=$1',[unsafe]);
      assert.equal(await stored(db,unsafe),null);

      // SAFE save-first: save holds the consent-row lock while a revoke
      // starts and actually blocks on that lock; revoke then deletes.
      const first='synthetic-savefirst-'+format;
      const saveGate=barrier();
      hooks.saveLocked.set(first,saveGate);
      const activeSave=post(first);
      let pendingRevocation;
      try {
        await timeout(saveGate.reached,'safe save row lock');
        pendingRevocation=revoke(first);
        await waitForPid(pids,first,'revoke');
        await waitForBlocked(db,pids.get(first).revoke,pids.get(first).save,
          'revoke waits for active save');
        counters.verifiedLockWaits++;
      } finally {
        saveGate.release();
      }
      assert.equal((await timeout(activeSave,'save-first POST')).status,200);
      assert.equal((await timeout(pendingRevocation,'save-first revoke')).status,200);
      assert.equal(await consent(db,first),false);
      assert.equal(await stored(db,first),null);
      assert.ok((await read(first)).body.data.every(x=>x.userAnswer===null));
      assert.equal((await post(first)).status,403);
      assert.equal(await stored(db,first),null);
      counters.saveFirstRevocations++;

      // SAFE revoke-first: revoked consent row is locked, concurrent save
      // must block until DELETE+COMMIT and then see granted=false (HTTP 403).
      const second='synthetic-revokefirst-'+format;
      assert.equal((await post(second)).status,200);
      // Forget the seed request's backend PID before observing the new race.
      pids.delete(second);
      const revokeGate=barrier();
      hooks.revokeUpdated.set(second,revokeGate);
      const inFlightRevoke=revoke(second);
      let blockedSave;
      try {
        await timeout(revokeGate.reached,'revocation update lock');
        blockedSave=post(second);
        await waitForPid(pids,second,'save');
        await waitForBlocked(db,pids.get(second).save,pids.get(second).revoke,
          'save waits for revocation');
        counters.verifiedLockWaits++;
      } finally {
        revokeGate.release();
      }
      assert.equal((await timeout(inFlightRevoke,'revoke-first revoke')).status,200);
      assert.equal((await timeout(blockedSave,'revoke-first save')).status,403);
      assert.equal(await consent(db,second),false);
      assert.equal(await stored(db,second),null);
      assert.ok((await read(second)).body.data.every(x=>x.userAnswer===null));
      counters.revokeFirstDeniedSaves++;

      // Atomicity: an error after consent UPDATE but before COMMIT must
      // roll back both consent change and BYTEA deletion.
      const rolled='synthetic-rollback-'+format;
      assert.equal((await post(rolled)).status,200);
      assert.equal((await revoke(rolled,true)).status,500);
      assert.equal(await consent(db,rolled),true);
      const retained=await stored(db,rolled);
      assert.ok(retained && Buffer.isBuffer(retained.payload));
      assert.equal((await read(rolled)).body.data[0].userAnswer,'f');
      counters.rollbackRestoresConsent++;
    }
    assert.deepEqual(counters,{
      negativeControlResurrections:3,
      saveFirstRevocations:3,
      revokeFirstDeniedSaves:3,
      rollbackRestoresConsent:3,
      verifiedLockWaits:6
    });
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM '+VOTES))
      .rows[0].n,3,'Only the three rollback fixture accounts retain votes');
    console.log('OPINION_CONSENT_RACE_SYNTHETIC_PASS');
    console.log('OPINION_CONSENT_RACE_RESULT_JSON='+JSON.stringify({
      postgres:17,formats:FORMATS,...counters,
      negativeControlShowsUnsafePrecheck:true,
      protectedTransactionsLockConsentRow:true,
      noResurrectionAfterProtectedRevoke:true,
      rollbackPreservesConsentAndVote:true,
      realDemosRoutesTested:false,realSupabaseTouched:false,
      note:'Synthetic negative control illustrates risk; not proof of live exploit'
    }));
  } finally {
    if(server)await new Promise(resolve=>server.close(resolve));
    await db.end();
  }
}
main().catch(err=>{
  console.error('Synthetic political-consent race test FAILED:',err);
  process.exitCode=1;
});
