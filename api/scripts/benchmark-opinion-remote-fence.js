'use strict';

/**
 * DOC-052 CI-only microbenchmark for the remote-journal read lock design.
 *
 * Compares the same SQL protected view with and without validation of a
 * separate PG17 journal. Measures request latency (p50/p95/mean), overlap
 * at concurrency 1/8, and the time a pending writer is delayed by a
 * deliberately long protected read. No production endpoints or data.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const {performance} = require('node:perf_hooks');
const {Client} = require('pg');
const {createCatalogRegistry,encodeEnvelope,decodeEnvelope} =
  require('../utils/opinionCodecEnvelope');

const JDB='opinion_remote_journal_ci';
const RDB='opinion_remote_restored_ci';
const SUBJECT='synthetic_bench_seed_052';
const READER='ci_remote_reader_050';
const KEY='ci-only-not-secret-no-production-use-doc050';
const ZERO='0'.repeat(64);
const REPS=128;
const CONCURRENCIES=[1,8];
const FIELDS=['synthetic_alpha','synthetic_beta','synthetic_gamma'];
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const sha=(seq,subject,epoch,prev)=>crypto.createHmac('sha256',KEY)
  .update(JSON.stringify([seq,subject,epoch,prev])).digest('hex');

function guard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.OPINION_BENCH_EPHEMERAL!=='yes'||
     e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
     e.PGDATABASE!=='opinion_bitset_ci'||
     e.PGUSER!=='postgres'||e.PGPASSWORD!=='synthetic-only'||
     e.OPINION_REMOTE_JOURNAL!=='synthetic-journal-only'||
     e.OPINION_REMOTE_CUTOVER!=='synthetic-fence-only'||
     e.OPINION_REMOTE_BENCH!=='synthetic-measure-only'){
    throw Error('Refusing benchmark outside isolated PG17 CI');
  }
}
async function open(name,port,app){
  const c=new Client({host:'127.0.0.1',port,database:name,
    user:'postgres',password:'synthetic-only',
    application_name:app,statement_timeout:14000,
    connectionTimeoutMillis:4000});
  await c.connect();
  return c;
}
async function journal(remote){
  const head=(await remote.query('SELECT last_seq,last_mac FROM '+
    'ci_remote_event_head WHERE singleton=true FOR SHARE')).rows[0];
  assert.ok(head);
  const rows=(await remote.query(
    'SELECT seq,subject,epoch,prev_mac,mac FROM ci_remote_events '+
    'ORDER BY seq')).rows;
  let previous=ZERO,seq=0;
  for(const e of rows){
    seq++;
    assert.equal(Number(e.seq),seq);
    assert.equal(e.prev_mac,previous);
    assert.equal(e.mac,sha(seq,e.subject,e.epoch,previous));
    previous=e.mac;
  }
  assert.equal(Number(head.last_seq),seq);
  assert.equal(head.last_mac,previous);
  return seq;
}
async function permittedLocal(target,remoteSeq=null){
  const g=(await target.query('SELECT sealed,last_seq FROM '+
    'ci_remote_gate WHERE singleton=true')).rows[0];
  assert.equal(g.sealed,false);
  if(remoteSeq!==null)assert.equal(Number(g.last_seq),remoteSeq);
  await target.query('SET ROLE '+READER);
  try{
    const r=await target.query('SELECT subject,payload FROM '+
      'ci_remote_readable ORDER BY subject');
    assert.equal(r.rowCount,1);
    assert.equal(r.rows[0].subject,SUBJECT);
    assert.ok(Buffer.isBuffer(r.rows[0].payload));
    return r.rows[0].payload;
  }finally{await target.query('RESET ROLE');}
}
async function read(kind,c){
  if(kind==='local')return permittedLocal(c.target);
  await c.remote.query('BEGIN');
  try{
    const seq=await journal(c.remote);
    return await permittedLocal(c.target,seq);
  }finally{
    // Must hold remote SHARE lock until all actual protected reads complete.
    await c.remote.query('ROLLBACK');
  }
}
const percentile=(values,p)=>{
  assert.ok(values.length>0);
  const ordered=[...values].sort((a,b)=>a-b);
  const index=Math.max(0,Math.ceil(p*ordered.length)-1);
  return +ordered[index].toFixed(3);
};
function metrics(times,durationMs){
  return {
    n:times.length,
    meanMs:+(times.reduce((a,b)=>a+b,0)/times.length).toFixed(3),
    p50Ms:percentile(times,.50),
    p95Ms:percentile(times,.95),
    p99Ms:percentile(times,.99),
    wallMs:+durationMs.toFixed(3),
    throughputOpsS:+(times.length*1000/durationMs).toFixed(1)
  };
}
async function suite(kind,workers,repetitions){
  const clients=[];
  try{
    for(let i=0;i<workers;i++){
      clients.push({
        target:await open(RDB,5432,'ci_052_'+kind+'_target_'+i),
        remote:kind==='remote'?
          await open(JDB,55432,'ci_052_remote_'+i):null
      });
    }
    const samples=Array.from({length:repetitions});
    let next=0;
    const started=performance.now();
    await Promise.all(clients.map(async c=>{
      while(next<repetitions){
        const n=next++;
        const begin=performance.now();
        const payload=await read(kind,c);
        // Identical semantic assertion for both scenarios.
        assert.ok(payload.length>0);
        samples[n]=performance.now()-begin;
      }
    }));
    const elapsed=performance.now()-started;
    assert.equal(samples.filter(Number.isFinite).length,repetitions);
    return metrics(samples,elapsed);
  }finally{
    await Promise.allSettled(clients.flatMap(c=>[
      c.target.end(),c.remote?.end()
    ]));
  }
}
async function seedFixture(target){
  const catalog=(await target.query('SELECT version,ordered_ids FROM '+
    'ci_remote_catalog ORDER BY version')).rows;
  const registry=createCatalogRegistry(catalog.map(r=>({
    version:r.version,ids:r.ordered_ids
  })));
  assert.equal(registry.latestVersion,2);
  const answers={synthetic_alpha:'c',synthetic_gamma:'i'};
  const enc=encodeEnvelope(registry,{
    version:2,encoding:'sparse',answers
  });
  assert.equal(decodeEnvelope(registry,{
    schemaVersion:1,catalogVersion:enc.catalogVersion,
    catalogFingerprint:enc.catalogFingerprint,
    encoding:enc.encoding,payload:enc.payload
  }).synthetic_gamma,'i');
  await target.query('INSERT INTO ci_remote_subjects'+
    ' (subject,granted,epoch) VALUES($1,true,1)',[SUBJECT]);
  await target.query('INSERT INTO ci_remote_votes'+
    ' (subject,catalog_version,catalog_fingerprint,encoding,payload,revision)'+
    ' VALUES($1,$2,$3,$4,$5,1)',[SUBJECT,enc.catalogVersion,
      enc.catalogFingerprint,enc.encoding,enc.payload]);
}
async function writerWait(){
  const reader=await open(JDB,55432,'ci_052_hold_reader');
  const writer=await open(JDB,55432,'ci_052_hold_writer');
  const observer=await open(JDB,55432,'ci_052_observer');
  let readerTx=false;
  let writerTx=false;
  let pending=null;
  try{
    await reader.query('BEGIN');
    readerTx=true;
    assert.equal(await journal(reader),5);
    const holder=(await reader.query(
      'SELECT pg_backend_pid() pid')).rows[0].pid;
    const waiter=(await writer.query(
      'SELECT pg_backend_pid() pid')).rows[0].pid;
    await writer.query('BEGIN');
    writerTx=true;
    const start=performance.now();
    // A harmless UPDATE rolled back later: no actual journal mutation.
    pending=writer.query('UPDATE ci_remote_event_head '+
      'SET last_seq=last_seq WHERE singleton=true');
    let sawBlocking=false;
    for(let attempt=0;attempt<180;attempt++){
      const blocked=(await observer.query(
        'SELECT pg_blocking_pids($1::integer) ids',[waiter])).rows[0].ids;
      if(blocked.includes(holder)){sawBlocking=true;break;}
      await sleep(12);
    }
    assert.equal(sawBlocking,true,'Expected real PG17 blocked writer');
    // Deliberate long-running read protects the head while writer waits.
    await sleep(125);
    await reader.query('ROLLBACK');
    readerTx=false;
    const changed=await pending;
    assert.equal(changed.rowCount,1);
    const ms=performance.now()-start;
    assert.ok(ms>=100,'Measured writer wait shorter than induced hold');
    await writer.query('ROLLBACK');
    writerTx=false;
    return {postgresBlockingObserved:true,inducedReadHoldMs:125,
      measuredWriterWaitMs:+ms.toFixed(2),
      updateRolledBack:true};
  }finally{
    if(readerTx)await reader.query('ROLLBACK').catch(()=>{});
    // Never close clients before the pending UPDATE has finished.
    if(pending)await pending.catch(()=>{});
    if(writerTx)await writer.query('ROLLBACK').catch(()=>{});
    await Promise.allSettled([
      reader.end(),writer.end(),observer.end()
    ]);
  }
}
async function failClosedOutage(){
  // An unreachable independent journal is a hard error, not a fallback
  // to a less restrictive local read path. Synthetic localhost only.
  const broken=new Client({host:'127.0.0.1',port:55433,database:JDB,
    user:'postgres',password:'synthetic-only',
    connectionTimeoutMillis:350});
  await assert.rejects(broken.connect());
  await broken.end().catch(()=>{});
  return true;
}
async function main(){
  guard();
  const target=await open(RDB,5432,'ci_052_fixture');
  try{
    const g=(await target.query('SELECT sealed,last_seq FROM '+
      'ci_remote_gate WHERE singleton=true')).rows[0];
    assert.equal(g.sealed,false);
    assert.equal(Number(g.last_seq),5);
    await seedFixture(target);
  }finally{await target.end();}
  const result=[];
  // Small warmup, then ABBA ordering to reduce warm-cache bias.
  for(const concurrency of CONCURRENCIES){
    await suite('local',concurrency,16);
    await suite('remote',concurrency,16);
    const localA=await suite('local',concurrency,REPS);
    const remoteA=await suite('remote',concurrency,REPS);
    const remoteB=await suite('remote',concurrency,REPS);
    const localB=await suite('local',concurrency,REPS);
    const avg=(a,b,k)=>+(0.5*(a[k]+b[k])).toFixed(3);
    const local={
      ...localA,
      meanMs:avg(localA,localB,'meanMs'),
      p50Ms:avg(localA,localB,'p50Ms'),
      p95Ms:avg(localA,localB,'p95Ms'),
      p99Ms:avg(localA,localB,'p99Ms'),
      throughputOpsS:avg(localA,localB,'throughputOpsS')
    };
    const remote={
      ...remoteA,
      meanMs:avg(remoteA,remoteB,'meanMs'),
      p50Ms:avg(remoteA,remoteB,'p50Ms'),
      p95Ms:avg(remoteA,remoteB,'p95Ms'),
      p99Ms:avg(remoteA,remoteB,'p99Ms'),
      throughputOpsS:avg(remoteA,remoteB,'throughputOpsS')
    };
    result.push({concurrency,requestsPerMode:REPS*2,
      baselineLocal:local,protectedRemote:remote,
      addedMeanLatencyMs:+(remote.meanMs-local.meanMs).toFixed(3),
      p95DeltaMs:+(remote.p95Ms-local.p95Ms).toFixed(3),
      throughputRatio:+(remote.throughputOpsS/local.throughputOpsS).toFixed(3)});
  }
  const writer=await writerWait();
  assert.equal(await failClosedOutage(),true);
  console.log('OPINION_REMOTE_FENCE_BENCH_PASS');
  console.log('OPINION_REMOTE_FENCE_BENCH_RESULT_JSON='+JSON.stringify({
    postgres:17,synthetic:true,
    setups:'two PostgreSQL 17 server processes on one GitHub runner',
    comparedQueries:'same single-row SQL protected-view read; remote adds '+
      'FOR SHARE head lock, HMAC chain verification and sequence check',
    concurrencyResult:result,writerWait:writer,
    unavailableRemoteDenied:true,noProductionAccess:true,
    limitations:[
      'This measures warm short SQL requests on one temporary Linux runner, NOT Internet/Supabase latency, real API HTTP time or Android.',
      'Do not extrapolate throughput as a capacity estimate or infer the benefit of BYTEA; baseline is an existing protected view, not a real DEMOS route.',
      'The extra HMAC check uses only five synthetic journal entries; an indefinitely growing log requires snapshot/checkpoint design.',
      'Cross-database reader locking creates availability coupling and is not wired to all production reads, writes, caches or RLS.',
      'No secure key management, remote geographic failure, real users, cost model, deployment or GDPR assurance.'
    ]
  }));
}
main().catch(e=>{
  console.error('CI remote journal read benchmark FAILED:',e);
  process.exitCode=1;
});
