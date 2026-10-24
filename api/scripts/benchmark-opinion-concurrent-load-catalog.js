'use strict';

/**
 * CI ONLY: contested PostgreSQL writes and stale opinion-catalog cache.
 * Every table, row, credential and account in this file is synthetic.
 * DOES NOT load real DEMOS routes, users, Supabase, JWT or RLS policies.
 * All DDL is limited to disposable GitHub Actions PostgreSQL 17.
 */
const assert=require('node:assert/strict');
const {performance}=require('node:perf_hooks');
const {Client,Pool}=require('pg');
const {
  createCatalogRegistry,encodeEnvelope,decodeEnvelope
}=require('../utils/opinionCodecEnvelope');
const {patchSparse,decodeSparse}=require('../utils/opinionSparseBitset');
const {catalogFingerprint}=require('../utils/opinionBitset');

const DB='opinion_bitset_ci',SUBJECTS=824,OPINIONS=94;
const WORKERS=8,REPEATS=12,HOLD_MS=5,VERSION_LOCK_TABLE='ci_load_catalog_head';
const IDS=Array.from({length:OPINIONS},(_,i)=>'opinion'+i);
const TEXT_COLS=IDS.map((_,i)=>'synthetic_opinion_'+String(i).padStart(3,'0'));
const TABLES={
  text:{hot:'ci_load_hot_text',spread:'ci_load_spread_text',
    source:'ci_mixed_2_text'},
  sparse_versioned:{hot:'ci_load_hot_binary',spread:'ci_load_spread_binary',
    source:'ci_mixed_2_sparse_versioned'}
};
const CATALOG='ci_load_catalog_versions';
const VOTES='ci_load_catalog_votes';
const APP='ci_load_concurrent_worker_247';
const uuid=n=>'00000000-0000-4000-8000-'+n.toString(16).padStart(12,'0');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
function guard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.OPINION_BENCH_EPHEMERAL!=='yes'||
     e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
     e.PGDATABASE!==DB||e.PGUSER!=='postgres'||
     e.PGPASSWORD!=='synthetic-only') {
    throw Error('Refusing concurrent load outside disposable CI PostgreSQL');
  }
}
function config(app){
  return {host:'127.0.0.1',port:5432,database:DB,
    user:'postgres',password:'synthetic-only',
    application_name:app,statement_timeout:17000};
}
function percentiles(ms){
  const sorted=[...ms].sort((a,b)=>a-b);
  return {n:sorted.length,
    medianMs:Number(sorted[Math.ceil(sorted.length*0.5)-1].toFixed(3)),
    p95Ms:Number(sorted[Math.ceil(sorted.length*0.95)-1].toFixed(3)),
    meanMs:Number((sorted.reduce((a,b)=>a+b,0)/sorted.length).toFixed(3))};
}
async function checkLocal(admin){
  const row=(await admin.query('SELECT current_database() db,'+
    'current_user::text actor,current_setting($1) v',
    ['server_version_num'])).rows[0];
  assert.equal(row.db,DB);
  assert.equal(row.actor,'postgres');
  assert.equal(Math.floor(Number(row.v)/10000),17);
}
async function fixtures(admin){
  await checkLocal(admin);
  for(const format of Object.keys(TABLES)){
    for(const mode of ['hot','spread']){
      const dest=TABLES[format][mode],source=TABLES[format].source;
      const identity=(await admin.query('SELECT to_regclass($1)::text relation',
        ['public.'+source])).rows[0].relation;
      assert.equal(identity,source,'DOC-042 fixture is required: '+source);
      // Copy first: load-induced row updates must NEVER alter DOC-042 or
      // DOC-043 source tables used by other CI steps.
      await admin.query('CREATE TABLE '+dest+' AS SELECT * FROM '+source);
      await admin.query('ALTER TABLE '+dest+' ADD PRIMARY KEY (user_id)');
      await admin.query('ALTER TABLE '+dest+
        ' ADD COLUMN revision integer NOT NULL DEFAULT 0');
      const counts=(await admin.query('SELECT COUNT(*)::int n,'+
        'COUNT(fonti_opinioni)::int sources FROM '+dest)).rows[0];
      assert.equal(counts.n,SUBJECTS);
      assert.equal(counts.sources,288);
      await admin.query('ANALYZE '+dest);
    }
  }
  await admin.query('CREATE TABLE '+CATALOG+' ('+
    'version integer PRIMARY KEY CHECK(version>0),'+
    'ordered_ids jsonb NOT NULL,fingerprint text NOT NULL)');
  await admin.query('CREATE TABLE '+VERSION_LOCK_TABLE+' ('+
    'singleton boolean PRIMARY KEY CHECK(singleton),'+
    'version integer NOT NULL REFERENCES '+CATALOG+'(version))');
  await admin.query('CREATE TABLE '+VOTES+' ('+
    'subject text PRIMARY KEY,'+
    'catalog_version integer NOT NULL REFERENCES '+CATALOG+'(version),'+
    'catalog_fingerprint text NOT NULL,encoding text NOT NULL,'+
    'payload bytea NOT NULL)');
  await admin.query('INSERT INTO '+CATALOG+
    ' (version,ordered_ids,fingerprint) VALUES ($1,$2::jsonb,$3)',
    [1,JSON.stringify(IDS),catalogFingerprint(IDS)]);
  await admin.query('INSERT INTO '+VERSION_LOCK_TABLE+
    ' (singleton,version) VALUES(true,1)');
}
async function oneWrite(client,table,format,id,slot,value){
  let began=false;
  const started=performance.now();
  try{
    await client.query('BEGIN');
    began=true;
    const col=TEXT_COLS[slot];
    if(format==='text'){
      const locked=(await client.query(
        'SELECT revision FROM '+table+' WHERE user_id=$1 FOR UPDATE',
        [id])).rows[0];
      assert.ok(locked);
      await client.query('SELECT pg_sleep($1::double precision)',
        [HOLD_MS/1000]);
      const result=await client.query('UPDATE '+table+' SET '+
        col+'=$1,revision=revision+1 WHERE user_id=$2',[value,id]);
      assert.equal(result.rowCount,1);
    }else{
      const locked=(await client.query(
        'SELECT opinions,catalog_version,revision FROM '+table+
        ' WHERE user_id=$1 FOR UPDATE',[id])).rows[0];
      assert.ok(locked);
      assert.equal(locked.catalog_version,1);
      await client.query('SELECT pg_sleep($1::double precision)',
        [HOLD_MS/1000]);
      const changed=patchSparse(IDS,locked.opinions,{[IDS[slot]]:value});
      const result=await client.query('UPDATE '+table+
        ' SET opinions=$1,revision=revision+1 WHERE user_id=$2',
        [changed,id]);
      assert.equal(result.rowCount,1);
    }
    await client.query('COMMIT');
    began=false;
    return performance.now()-started;
  }catch(e){
    if(began)await client.query('ROLLBACK');
    throw e;
  }
}
async function lockWaitObserved(observer){
  const until=Date.now()+2500;
  while(Date.now()<until){
    const rows=await observer.query(
      'SELECT pid,pg_blocking_pids(pid) blockers FROM pg_stat_activity '+
      'WHERE application_name=$1 AND wait_event_type=$2',
      [APP,'Lock']);
    if(rows.rows.some(row=>row.blockers.length>0))return true;
    await sleep(9);
  }
  return false;
}
async function stress(pool,observer,admin,format,mode){
  const table=TABLES[format][mode],hot=mode==='hot';
  const conns=await Promise.all(
    Array.from({length:WORKERS},()=>pool.connect()));
  let start;
  const barrier=new Promise(resolve=>{start=resolve;});
  const workerTimes=[];
  try{
    const jobs=conns.map((client,w)=>async()=>{
      await barrier;
      const id=uuid(hot?1:w+1),slot=w+10;
      const own=[];
      for(let n=0;n<REPEATS;n++){
        const value=['f','c','i'][n%3];
        own.push(await oneWrite(client,table,format,id,slot,value));
      }
      return own;
    });
    const running=Promise.all(jobs.map(fn=>fn()));
    start();
    const observed=hot?await lockWaitObserved(observer):false;
    for(const times of await running)workerTimes.push(...times);
    if(hot)assert.ok(observed,'Hot-row PostgreSQL row lock contention must be observed');
    const expected=hot?WORKERS*REPEATS:REPEATS;
    const ids=hot?[uuid(1)]:Array.from({length:WORKERS},(_,i)=>uuid(i+1));
    for(let worker=0;worker<ids.length;worker++){
      const id=ids[worker];
      const row=(await admin.query(
        'SELECT * FROM '+table+' WHERE user_id=$1',[id])).rows[0];
      assert.ok(row);
      assert.equal(row.revision,expected,
        'Every concurrent transaction must increment the revision');
      const values=format==='text'?row:decodeSparse(IDS,row.opinions);
      if(hot){
        for(let w=0;w<WORKERS;w++){
          const value=format==='text'?values[TEXT_COLS[w+10]]:
            values[IDS[w+10]];
          assert.equal(value,'i','Disjoint writes to one row must all survive');
        }
      }else{
        const value=format==='text'?values[TEXT_COLS[worker+10]]:
          values[IDS[worker+10]];
        assert.equal(value,'i','Per-account last write must survive');
      }
    }
    assert.equal(workerTimes.length,WORKERS*REPEATS);
    return {mode,format,workers:WORKERS,repeatsPerWorker:REPEATS,
      transactions:workerTimes.length,
      controlledLockHoldMs:HOLD_MS,
      observedPostgresBlocking:observed,
      latency:percentiles(workerTimes),
      totalRevisionsVerified:expected*ids.length,
      separateAccounts:hot?1:WORKERS,
      lostUpdates:0};
  }finally{
    conns.forEach(c=>c.release());
  }
}
async function catalogFromSql(client){
  const rows=(await client.query(
    'SELECT version,ordered_ids,fingerprint FROM '+CATALOG+
    ' ORDER BY version')).rows;
  const registry=createCatalogRegistry(rows.map(x=>({
    version:x.version,ids:x.ordered_ids
  })));
  for(const row of rows){
    assert.equal(registry.get(row.version).fingerprint,row.fingerprint,
      'Catalog fingerprint mismatched: fail closed');
  }
  return registry;
}
async function withLatestCachedWrite(client,cache,subject,answers){
  let began=false;
  try{
    await client.query('BEGIN');
    began=true;
    // Shared head lock permits parallel writers but blocks appends while
    // an answer is being bound to the latest catalog.
    const r=await client.query('SELECT version FROM '+VERSION_LOCK_TABLE+
      ' WHERE singleton=true FOR SHARE');
    if(cache.latestVersion!==r.rows[0].version){
      throw Error('STALE_CATALOG: refresh mandatory before latest write');
    }
    const payload=encodeEnvelope(cache,{
      version:cache.latestVersion,encoding:'sparse',answers
    });
    await client.query('INSERT INTO '+VOTES+
      ' (subject,catalog_version,catalog_fingerprint,encoding,payload)'+
      ' VALUES ($1,$2,$3,$4,$5) ON CONFLICT (subject) DO UPDATE SET '+
      'catalog_version=EXCLUDED.catalog_version,'+
      'catalog_fingerprint=EXCLUDED.catalog_fingerprint,'+
      'encoding=EXCLUDED.encoding,payload=EXCLUDED.payload',
      [subject,payload.catalogVersion,payload.catalogFingerprint,
        payload.encoding,payload.payload]);
    await client.query('COMMIT');
    began=false;
  }catch(e){
    if(began)await client.query('ROLLBACK');
    throw e;
  }
}
async function appendVersion(client,expected,newId){
  let began=false;
  try{
    await client.query('BEGIN');
    began=true;
    // The exclusive head row lock serializes appends while allowing
    // concurrent FOR SHARE reads/writes of the active version.
    const head=(await client.query('SELECT version FROM '+VERSION_LOCK_TABLE+
      ' WHERE singleton=true FOR UPDATE')).rows[0];
    if(head.version!==expected){
      throw Error('STALE_CATALOG: rejected competing catalog append');
    }
    const registry=await catalogFromSql(client);
    assert.equal(registry.latestVersion,expected);
    const nextIds=[...registry.get(expected).ids,newId];
    const next=createCatalogRegistry([...registry.versions.map(v=>({
      version:v,ids:registry.get(v).ids
    })),{version:expected+1,ids:nextIds}]).get(expected+1);
    await client.query('INSERT INTO '+CATALOG+
      ' (version,ordered_ids,fingerprint) VALUES($1,$2::jsonb,$3)',
      [next.version,JSON.stringify(next.ids),next.fingerprint]);
    await client.query('UPDATE '+VERSION_LOCK_TABLE+
      ' SET version=$1 WHERE singleton=true',[next.version]);
    await client.query('COMMIT');
    began=false;
    return next.version;
  }catch(e){
    if(began)await client.query('ROLLBACK');
    throw e;
  }
}
async function cacheContract(admin){
  const first=new Client(config('ci_load_cache_worker_a'));
  const second=new Client(config('ci_load_cache_worker_b'));
  await Promise.all([first.connect(),second.connect()]);
  try{
    let cacheA=await catalogFromSql(first);
    let cacheB=await catalogFromSql(second);
    assert.equal(cacheA.latestVersion,1);
    assert.equal(cacheB.latestVersion,1);
    await withLatestCachedWrite(first,cacheA,'historical',
      {opinion0:'f',opinion3:'i'});
    const versions=await Promise.allSettled([
      appendVersion(first,1,'new_synthetic_a'),
      appendVersion(second,1,'new_synthetic_b')
    ]);
    assert.equal(versions.filter(x=>x.status==='fulfilled').length,1);
    assert.equal(versions.filter(x=>x.status==='rejected').length,1);
    assert.match(versions.find(x=>x.status==='rejected').reason.message,
      /STALE_CATALOG/);
    assert.equal((await admin.query('SELECT version FROM '+
      VERSION_LOCK_TABLE+' WHERE singleton=true')).rows[0].version,2);
    const before=(await admin.query('SELECT COUNT(*)::int n FROM '+
      VOTES)).rows[0].n;
    await assert.rejects(withLatestCachedWrite(second,cacheB,'should_not_exist',
      {opinion0:'c'}),/STALE_CATALOG/);
    assert.equal((await admin.query('SELECT COUNT(*)::int n FROM '+
      VOTES)).rows[0].n,before);
    cacheB=await catalogFromSql(second);
    assert.equal(cacheB.latestVersion,2);
    const latestIds=cacheB.get(2).ids;
    const appendedId=latestIds.at(-1);
    await withLatestCachedWrite(second,cacheB,'new_valid',
      {[appendedId]:'i',opinion1:'c'});
    const history=(await admin.query(
      'SELECT catalog_version,catalog_fingerprint,encoding,payload '+
      'FROM '+VOTES+' WHERE subject=$1',['historical'])).rows[0];
    assert.equal(history.catalog_version,1);
    assert.deepEqual(decodeEnvelope(cacheB,{
      schemaVersion:1,catalogVersion:history.catalog_version,
      catalogFingerprint:history.catalog_fingerprint,
      encoding:history.encoding,payload:history.payload
    }),{
      ...Object.fromEntries(IDS.map(id=>[id,id==='opinion0'?'f':
        id==='opinion3'?'i':null])),
      [appendedId]:null
    });
    const current=(await admin.query(
      'SELECT catalog_version,catalog_fingerprint,encoding,payload '+
      'FROM '+VOTES+' WHERE subject=$1',['new_valid'])).rows[0];
    assert.equal(current.catalog_version,2);
    const decoded=decodeEnvelope(cacheB,{
      schemaVersion:1,catalogVersion:current.catalog_version,
      catalogFingerprint:current.catalog_fingerprint,
      encoding:current.encoding,payload:current.payload
    });
    assert.equal(decoded[appendedId],'i');
    assert.equal(decoded.opinion1,'c');
    // A corrupt on-disk fingerprint must never be silently cached.
    await admin.query('BEGIN');
    try{
      await admin.query('UPDATE '+CATALOG+
        ' SET fingerprint=$1 WHERE version=1',['0'.repeat(64)]);
      await assert.rejects(catalogFromSql(admin),/fingerprint/i);
    }finally{
      await admin.query('ROLLBACK');
    }
    cacheA=await catalogFromSql(first);
    assert.equal(cacheA.latestVersion,2);
    const size=(await admin.query('SELECT pg_total_relation_size('+
      '$1::regclass)::bigint bytes',['public.'+CATALOG])).rows[0].bytes;
    return {
      appendAttempts:2,appendsAccepted:1,staleAppendRejected:1,
      staleCachedWriteRejected:1,
      cacheRefreshAfterHeadChange:true,
      historicalVersionOneDecodedAfterAppend:true,
      newVersionTwoWriteVerified:true,
      corruptedCatalogFingerprintRejected:true,
      cacheHeadPolicy:'SELECT catalog head FOR SHARE per latest write; append uses FOR UPDATE',
      catalogTableBytes:Number(size),
      note:'Two independent connections and caches in one CI process; not multi-region or production cache invalidation'
    };
  }finally{
    await Promise.allSettled([first.end(),second.end()]);
  }
}
async function main(){
  guard();
  const admin=new Client(config('ci_load_contended_observer_247'));
  const observer=new Client(config('ci_load_lock_observer_247'));
  const pool=new Pool({...config(APP),max:WORKERS+1});
  try{
    await Promise.all([admin.connect(),observer.connect()]);
    await fixtures(admin);
    const results=[];
    for(const format of ['text','sparse_versioned']){
      for(const mode of ['hot','spread']){
        results.push(await stress(pool,observer,admin,format,mode));
      }
    }
    const catalog=await cacheContract(admin);
    console.log('OPINION_LOAD_AND_CACHE_SAFETY_PASS');
    console.log('OPINION_LOAD_AND_CACHE_RESULT_JSON='+JSON.stringify({
      postgres:17,subjects:SUBJECTS,opinionSlots:OPINIONS,
      artificialSourceFrequency:0.35,
      concurrency:WORKERS,transactionsPerTrial:WORKERS*REPEATS,
      syntheticLockHoldMs:HOLD_MS,
      results,catalog,
      noSupabaseAccess:true,noRealRoutesWired:true,
      constraints:[
        'Controlled lock-hold time is injected into every write to expose queuing; results are not production latency.',
        'Uses isolated copies of DOC-042 synthetic tables; no production writes or personal data.',
        'Shared head FOR SHARE allows concurrent writers, FOR UPDATE serializes catalog append. It is not deployed.',
        'Only one logical hot account is tested at a time, with eight disjoint opinion slots.',
        'No JWT, app session cache, consent, RLS, Android, geographic replica, crash recovery or network latency.',
        'No prediction of actual server capacity, operating cost or Supabase free-tier limits.'
      ]
    }));
  }finally{
    await pool.end();
    await Promise.allSettled([observer.end(),admin.end()]);
  }
}
main().catch(e=>{
  console.error('Contested synthetic workload/catalog cache FAILED:',e);
  process.exitCode=1;
});
