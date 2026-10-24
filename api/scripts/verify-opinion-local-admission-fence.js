'use strict';

/**
 * DOC-053: prototype a LOCAL admission fence, without a remote journal round
 * trip on ordinary reads. All revocation coordinators MUST seal the local gate
 * and record a durable local intent BEFORE publishing a remote erase event.
 *
 * Isolated GitHub Actions PostgreSQL 17 fixtures only. Not DEMOS middleware.
 * No real accounts, credentials, production schema, Supabase or deployment.
 */
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Client}=require('pg');
const {createCatalogRegistry,encodeEnvelope,decodeEnvelope}=
  require('../utils/opinionCodecEnvelope');
const LOCAL='opinion_local_fence_ci';
const REMOTE='opinion_remote_journal_ci';
const ROLE='ci_lf_reader_053';
const LOCK_A=530053,LOCK_B=1;
const SUBJECTS=['synthetic_a','synthetic_b','synthetic_c','synthetic_d'];
const IDS=['synthetic_alpha','synthetic_beta'];
const KEY='doc053-public-ci-hmac-only';
const SEED='0'.repeat(64);
const T={
  gate:'ci_lf_gate',users:'ci_lf_users',votes:'ci_lf_votes',
  requests:'ci_lf_requests',intents:'ci_lf_intents',
  head:'ci_lf_remote_head',events:'ci_lf_remote_events',
  fn:'ci_lf_read'
};
function guard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.OPINION_BENCH_EPHEMERAL!=='yes'||
    e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
    e.PGDATABASE!=='opinion_bitset_ci'||e.PGUSER!=='postgres'||
    e.PGPASSWORD!=='synthetic-only'||
    e.OPINION_REMOTE_JOURNAL!=='synthetic-journal-only'||
    e.OPINION_LOCAL_FENCE!=='ci-local-only-053'){
    throw Error('Refusing DOC-053 outside disposable GitHub Actions PG17');
  }
}
async function open(database,port,app){
  const c=new Client({host:'127.0.0.1',port,database,
    user:'postgres',password:'synthetic-only',application_name:app,
    statement_timeout:12000,connectionTimeoutMillis:4000});
  await c.connect();
  return c;
}
async function identity(c,name){
  const r=(await c.query("SELECT current_database() db,current_user actor,current_setting('server_version_num')::integer num")).rows[0];
  assert.equal(r.db,name);assert.equal(r.actor,'postgres');
  assert.equal(Math.floor(r.num/10000),17);
}
function mac(seq,id,subject,epoch,prev){
  return crypto.createHmac('sha256',KEY)
    .update(JSON.stringify([seq,id,subject,epoch,prev])).digest('hex');
}
async function fixture(local,remote){
  await identity(local,LOCAL);await identity(remote,REMOTE);
  await local.query('CREATE TABLE '+T.gate+' ('+
    'singleton boolean PRIMARY KEY CHECK(singleton), sealed boolean NOT NULL,'+
    'last_seq bigint NOT NULL DEFAULT 0)');
  await local.query('INSERT INTO '+T.gate+' (singleton,sealed,last_seq) VALUES(true,false,0)');
  await local.query('CREATE TABLE '+T.users+' ('+
    'subject text PRIMARY KEY,granted boolean NOT NULL,epoch integer NOT NULL)');
  await local.query('CREATE TABLE '+T.votes+' ('+
    'subject text PRIMARY KEY REFERENCES '+T.users+'(subject),'+
    'payload bytea NOT NULL,revision integer NOT NULL)');
  await local.query('CREATE TABLE '+T.requests+' ('+
    'subject text NOT NULL REFERENCES '+T.users+'(subject),'+
    'request_id text NOT NULL,PRIMARY KEY(subject,request_id))');
  await local.query('CREATE TABLE '+T.intents+' ('+
    'id text PRIMARY KEY,subject text NOT NULL REFERENCES '+T.users+'(subject),'+
    'epoch integer NOT NULL,created_at timestamptz NOT NULL DEFAULT now())');
  await remote.query('CREATE TABLE '+T.head+' ('+
    'singleton boolean PRIMARY KEY CHECK(singleton),seq bigint NOT NULL,'+
    'mac text NOT NULL)');
  await remote.query('CREATE TABLE '+T.events+' ('+
    'seq bigint PRIMARY KEY,id text UNIQUE NOT NULL,'+
    'subject text NOT NULL,epoch integer NOT NULL,'+
    'previous_mac text NOT NULL,mac text NOT NULL)');
  await remote.query('INSERT INTO '+T.head+'(singleton,seq,mac) VALUES(true,0,$1)',[SEED]);
  const registry=createCatalogRegistry([{version:1,ids:IDS}]);
  for(const s of SUBJECTS){
    const enc=encodeEnvelope(registry,{version:1,encoding:'sparse',
      answers:{synthetic_alpha:'f',synthetic_beta:'i'}});
    await local.query('INSERT INTO '+T.users+'(subject,granted,epoch) VALUES($1,true,1)',[s]);
    await local.query('INSERT INTO '+T.votes+'(subject,payload,revision) VALUES($1,$2,1)',
      [s,enc.payload]);
    await local.query('INSERT INTO '+T.requests+'(subject,request_id) VALUES($1,$2)',
      [s,'old-request']);
  }
  // SECURITY DEFINER is deliberately restricted to one fixed read function.
  // It locks gate FOR SHARE through the request transaction and refuses a
  // sealed gate BEFORE returning any BYTEA. Callers cannot SELECT raw votes.
  await local.query("CREATE FUNCTION "+T.fn+"(p_subject text) "+
    "RETURNS TABLE(subject text,payload bytea) LANGUAGE plpgsql "+
    "SECURITY DEFINER SET search_path=pg_catalog,public AS $$ "+
    "BEGIN PERFORM 1 FROM public."+T.gate+
    " WHERE singleton=true AND sealed=false FOR SHARE; "+
    "IF NOT FOUND THEN RAISE EXCEPTION 'LOCAL_READ_SEALED' USING ERRCODE='55000'; "+
    "END IF; RETURN QUERY SELECT v.subject,v.payload FROM public."+T.votes+
    " v JOIN public."+T.users+
    " u ON v.subject=u.subject WHERE v.subject=p_subject AND u.granted=true; "+
    "END; $$");
  await local.query('CREATE ROLE '+ROLE+' NOLOGIN');
  await local.query('REVOKE ALL ON FUNCTION '+T.fn+'(text) FROM PUBLIC');
  await local.query('GRANT USAGE ON SCHEMA public TO '+ROLE);
  await local.query('GRANT EXECUTE ON FUNCTION '+T.fn+'(text) TO '+ROLE);
  console.log('OPINION_LOCAL_FENCE_FIXTURE_READY');
}
async function gate(c){
  const r=(await c.query('SELECT sealed,last_seq FROM '+T.gate+' WHERE singleton=true')).rows[0];
  return {sealed:r.sealed,seq:Number(r.last_seq)};
}
async function privateRead(c,s,options={}){
  await c.query('BEGIN');
  try{
    await c.query('SET LOCAL ROLE '+ROLE);
    if(options.verifyDeniedRaw){
      await c.query('SAVEPOINT raw_denial');
      await assert.rejects(c.query('SELECT payload FROM '+T.votes),
        /permission denied/i);
      await c.query('ROLLBACK TO SAVEPOINT raw_denial');
    }
    const rows=(await c.query('SELECT subject,payload FROM '+T.fn+'($1)',[s])).rows;
    if(options.afterRead)await options.afterRead();
    await c.query('COMMIT');
    return rows;
  }catch(e){await c.query('ROLLBACK');throw e;}
}
async function observedBlock(observer,waiter,holder,label){
  for(let k=0;k<250;k++){
    const p=(await observer.query('SELECT pg_blocking_pids($1::integer) p',[waiter])).rows[0].p;
    if(p.includes(holder))return;
    await new Promise(resolve=>setTimeout(resolve,18));
  }
  throw Error('Expected actual PG17 blocked gate: '+label);
}
async function pid(c){return (await c.query('SELECT pg_backend_pid() pid')).rows[0].pid;}
async function acquire(c){await c.query('SELECT pg_advisory_lock($1,$2)',[LOCK_A,LOCK_B]);}
async function release(c){await c.query('SELECT pg_advisory_unlock($1,$2)',[LOCK_A,LOCK_B]);}
async function sealIntent(c,id,s){
  assert.ok(SUBJECTS.includes(s));assert.match(id,/^erase-[a-z0-9-]+$/);
  await c.query('BEGIN');
  try{
    // UPDATE acquires an exclusive gate row lock; all admitted reads must
    // finish before the gate can be committed closed.
    await c.query('UPDATE '+T.gate+' SET sealed=true WHERE singleton=true');
    const row=await c.query('INSERT INTO '+T.intents+
      '(id,subject,epoch) VALUES($1,$2,2) ON CONFLICT(id) DO NOTHING RETURNING id',
      [id,s]);
    if(!row.rowCount){
      const previous=(await c.query('SELECT subject,epoch FROM '+T.intents+
        ' WHERE id=$1',[id])).rows[0];
      assert.equal(previous.subject,s);assert.equal(previous.epoch,2);
    }
    await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK');throw e;}
}
async function append(remote,id,s){
  const old=(await remote.query('SELECT seq FROM '+T.events+' WHERE id=$1',[id])).rows[0];
  if(old)return Number(old.seq);
  await remote.query('BEGIN');
  try{
    const head=(await remote.query('SELECT seq,mac FROM '+T.head+
      ' WHERE singleton=true FOR UPDATE')).rows[0];
    const known=(await remote.query('SELECT seq,subject,epoch FROM '+T.events+
      ' WHERE id=$1',[id])).rows[0];
    if(known){
      assert.equal(known.subject,s);assert.equal(known.epoch,2);
      await remote.query('COMMIT');return Number(known.seq);
    }
    const next=Number(head.seq)+1;
    const digest=mac(next,id,s,2,head.mac);
    await remote.query('INSERT INTO '+T.events+
      '(seq,id,subject,epoch,previous_mac,mac) VALUES($1,$2,$3,2,$4,$5)',
      [next,id,s,head.mac,digest]);
    await remote.query('UPDATE '+T.head+' SET seq=$1,mac=$2 WHERE singleton=true',
      [next,digest]);
    await remote.query('COMMIT');
    return next;
  }catch(e){await remote.query('ROLLBACK');throw e;}
}
async function checkedEvents(remote){
  const head=(await remote.query('SELECT seq,mac FROM '+T.head+
    ' WHERE singleton=true FOR SHARE')).rows[0];
  const events=(await remote.query('SELECT * FROM '+T.events+' ORDER BY seq')).rows;
  let previous=SEED;
  for(let i=0;i<events.length;i++){
    const e=events[i],seq=i+1;
    assert.equal(Number(e.seq),seq);
    assert.equal(e.previous_mac,previous);
    assert.equal(e.mac,mac(seq,e.id,e.subject,e.epoch,previous));
    assert.equal(e.epoch,2);
    previous=e.mac;
  }
  assert.equal(Number(head.seq),events.length);
  assert.equal(head.mac,previous);
  return events;
}
async function reconcile(local,remote){
  await remote.query('BEGIN');
  try{
    // The remote SHARE lock prevents head changes through local COMMIT.
    const events=await checkedEvents(remote);
    await local.query('BEGIN');
    try{
      const start=(await local.query('SELECT sealed,last_seq FROM '+T.gate+
        ' WHERE singleton=true FOR UPDATE')).rows[0];
      if(!start.sealed)throw Error('RECONCILIATION_REQUIRES_SEALED_GATE');
      let seq=Number(start.last_seq);
      for(const e of events){
        if(Number(e.seq)<=seq)continue;
        assert.equal(Number(e.seq),seq+1);
        const r=await local.query('UPDATE '+T.users+
          ' SET granted=false,epoch=GREATEST(epoch,$2) WHERE subject=$1 RETURNING subject',
          [e.subject,e.epoch]);
        assert.equal(r.rowCount,1);
        await local.query('DELETE FROM '+T.votes+' WHERE subject=$1',[e.subject]);
        await local.query('DELETE FROM '+T.requests+' WHERE subject=$1',[e.subject]);
        seq++;
      }
      // All durable local intents must exist in the remote journal.
      const missing=await local.query('SELECT id FROM '+T.intents+
        ' WHERE NOT (id = ANY($1::text[]))', [events.map(e=>e.id)]);
      if(missing.rowCount)throw Error('UNPUBLISHED_LOCAL_ERASURE_INTENT');
      assert.equal(seq,events.length);
      await local.query('UPDATE '+T.gate+
        ' SET last_seq=$1,sealed=false WHERE singleton=true',[seq]);
      await local.query('COMMIT');
      return seq;
    }catch(e){await local.query('ROLLBACK');throw e;}
  }finally{await remote.query('ROLLBACK');}
}
async function snap(local,s){
  const u=(await local.query('SELECT granted,epoch FROM '+T.users+' WHERE subject=$1',[s])).rows[0];
  const v=(await local.query('SELECT payload FROM '+T.votes+' WHERE subject=$1',[s])).rows[0]||null;
  const r=(await local.query('SELECT request_id FROM '+T.requests+' WHERE subject=$1',[s])).rows;
  return {u,v,r};
}
async function main(){
  guard();
  const local=await open(LOCAL,5432,'doc053_main');
  const remote=await open(REMOTE,55432,'doc053_journal');
  const reader=await open(LOCAL,5432,'doc053_reader');
  const writer=await open(LOCAL,5432,'doc053_writer');
  const observer=await open(LOCAL,5432,'doc053_observer');
  let active=0,blockedCount=0;
  try{
    await fixture(local,remote);
    assert.deepEqual(await gate(local),{sealed:false,seq:0});
    const eligible=await privateRead(reader,SUBJECTS[0],{verifyDeniedRaw:true});
    assert.equal(eligible.length,1);
    assert.ok(Buffer.isBuffer(eligible[0].payload));

    // Reader already admitted: coordinator may not seal and publish remote
    // event until the local SQL read transaction finishes.
    await acquire(writer);active=1;
    const rp=pid(reader),wp=await pid(writer);
    let continueRead;
    const hold=new Promise(r=>{continueRead=r;});
    let readEntered;
    const reached=new Promise(r=>{readEntered=r;});
    const runningRead=privateRead(reader,SUBJECTS[0],{
      afterRead:async()=>{readEntered();await hold;}
    });
    await reached;
    const sealing=sealIntent(writer,'erase-a',SUBJECTS[0]);
    try{
      await observedBlock(observer,wp,await rp,'read-before-local-seal');
      blockedCount++;
      assert.equal(Number((await remote.query('SELECT seq FROM '+T.head+
        ' WHERE singleton=true')).rows[0].seq),0);
    }finally{continueRead();}
    assert.equal((await runningRead).length,1);
    await sealing;
    assert.equal((await gate(local)).sealed,true);
    await assert.rejects(privateRead(reader,SUBJECTS[0]),/LOCAL_READ_SEALED/);
    assert.equal(await append(remote,'erase-a',SUBJECTS[0]),1);
    assert.equal(await reconcile(writer,remote),1);
    await release(writer);active=0;
    assert.deepEqual(await gate(local),{sealed:false,seq:1});
    assert.equal((await privateRead(reader,SUBJECTS[0])).length,0);
    assert.equal((await privateRead(reader,SUBJECTS[1])).length,1);

    // Journal outage AFTER seal: local remains closed; a newly restarted
    // coordinator can publish the durable intent and reconcile.
    await acquire(writer);active=1;
    await sealIntent(writer,'erase-b',SUBJECTS[1]);
    assert.equal((await gate(local)).sealed,true);
    await assert.rejects(privateRead(reader,SUBJECTS[2]),/LOCAL_READ_SEALED/);
    // Simulate remote outage without touching real PG or the journal.
    await assert.rejects(Promise.reject(Error('SIMULATED_JOURNAL_UNREACHABLE')),
      /SIMULATED_JOURNAL_UNREACHABLE/);
    await release(writer);active=0;
    const restarted=await open(LOCAL,5432,'doc053_recover_b');
    try{
      await acquire(restarted);
      assert.equal(await append(remote,'erase-b',SUBJECTS[1]),2);
      assert.equal(await reconcile(restarted,remote),2);
      await release(restarted);
    }finally{await restarted.end();}
    assert.equal((await privateRead(reader,SUBJECTS[1])).length,0);
    assert.equal((await privateRead(reader,SUBJECTS[2])).length,1);

    // Crash after external COMMIT but before local erasure: still sealed.
    await acquire(writer);active=1;
    await sealIntent(writer,'erase-c',SUBJECTS[2]);
    assert.equal(await append(remote,'erase-c',SUBJECTS[2]),3);
    assert.ok((await snap(local,SUBJECTS[2])).v,
      'Remote event commits while stale BYTEA still exists locally');
    await assert.rejects(privateRead(reader,SUBJECTS[2]),/LOCAL_READ_SEALED/);
    await release(writer);active=0;
    await acquire(writer);active=1;
    assert.equal(await reconcile(writer,remote),3);
    await release(writer);active=0;
    assert.equal((await privateRead(reader,SUBJECTS[2])).length,0);

    // NEGATIVE CONTROL: uncoordinated writer can violate the guarantee.
    // Explicitly document the strict all-writers coordination requirement.
    assert.equal((await privateRead(reader,SUBJECTS[3])).length,1);
    assert.equal(await append(remote,'erase-d-rogue',SUBJECTS[3]),4);
    const dangerous=(await privateRead(reader,SUBJECTS[3])).length;
    assert.equal(dangerous,1,'Negative control must demonstrate bypass');
    // Repair under an authorized coordinator before test completes.
    await acquire(writer);active=1;
    await sealIntent(writer,'erase-d-rogue',SUBJECTS[3]);
    assert.equal(await reconcile(writer,remote),4);
    await release(writer);active=0;
    assert.equal((await privateRead(reader,SUBJECTS[3])).length,0);

    for(const s of SUBJECTS){
      const x=await snap(local,s);
      assert.equal(x.u.granted,false);
      assert.equal(x.u.epoch,2);
      assert.equal(x.v,null);
      assert.equal(x.r.length,0);
    }
    assert.deepEqual(await gate(local),{sealed:false,seq:4});
    assert.equal(blockedCount,1);
    console.log('OPINION_LOCAL_ADMISSION_FENCE_PASS');
    console.log('OPINION_LOCAL_ADMISSION_RESULT_JSON='+JSON.stringify({
      postgres:17,synthetic:true,
      localSecurityDefinerFunctionAndRestrictedReader:true,
      perReadRemoteConnections:0,
      observedRealReaderVsLocalSealLocks:blockedCount,
      remoteEventNotPublishedUntilLocalReadEnds:true,
      outageAfterSealKeepsReadsClosed:true,
      restartedCoordinatorReconcilesDurableIntent:true,
      crashAfterRemoteAppendKeepsReadsClosed:true,
      erasedVotesAndRetryKeys:SUBJECTS.length,
      sequentialRemoteJournalEvents:4,
      negativeControlOutOfBandJournalWriteExposesStaleVote:true,
      repairedNegativeControl:true,
      noProductionOrSupabaseAccess:true,
      limitations:[
        'Only a strict sole-coordinator writer protocol provides the safety property; direct out-of-band journal append bypasses it, as the negative control deliberately proves.',
        'No atomic commit across PostgreSQL clusters, and a journal-first crash could require manual/automated recovery of durable local intents.',
        'Restoring an old primary backup that has an open gate needs an external sealed admission/cutover; this test does not prove safe boot, replicas or all APIs.',
        'SQL function uses a limited CI role, not production authentication or Supabase RLS. Other SQL paths and caches must be forbidden or separately fenced.',
        'Advisory session serialization could bottleneck writes. No geographic durability, production latency, load, cost, policy or GDPR compliance is tested.'
      ]
    }));
  }finally{
    if(active)await release(writer).catch(()=>{});
    await Promise.allSettled([local.end(),remote.end(),reader.end(),
      writer.end(),observer.end()]);
  }
}
main().catch(e=>{console.error('CI local admission fence FAILED:',e);process.exitCode=1;});
