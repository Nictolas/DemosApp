'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {assertSourceSyncEnv,prepareRows,UPSERT_SQL,BASELINE_SQL,MISSING_SOURCE_IDS_SQL,syncOnce}=
  require('../staging/ministeroStagingSyncOnce');

const makeRow=(id=217,title='Public Ministry source',type='Legge di iniziativa popolare')=>({
  id:'ministero_'+id,id_ministero:String(id),titolo:title,tipo:type,
  stato:'in_corso',data_inizio_raw:'2026-11-01',data_fine_raw:'2027-05-01',
  firme_raccolte:50001,categoria_notifica:type==='Referendum abrogativo'?
    'referendum_abrogativi':'iniziative_popolari',
  target_path:type==='Referendum abrogativo'?
    '/referendum-abrogativi':'/iniziative-popolari',
  sito_web:'https://firmereferendum.giustizia.it/referendum/open/dettaglio-open/'+id,
});

function fakeDatabase({guard=true,role='demos_staging_runtime',oldCount=2,
  actionable=0,missingCount=0,upsertCount=2,suppressedCount=1,lock=true,failAt=null}={}){
  const calls=[];let released=null,ended=0;
  const client={
    async query(sql,params=[]){
      calls.push({sql,params});
      if(failAt&&sql.includes(failAt))throw Error('provider-password-SECRET');
      if(sql.includes('current_user::text'))return {rows:[{
        role_name:role,database_name:'postgres',
        identity_hash:'0cbb6ace68a9f11956904e2a37898ec8',
      }]};
      if(sql.includes('pg_try_advisory_xact_lock'))return {rows:[{acquired:lock}]};
      if(sql.includes('civic_push_delivery_guard WHERE id=1 FOR SHARE'))
        return {rows:[{blocked:guard}]};
      if(sql.includes('old_count'))return {rows:[{old_count:oldCount,actionable}]};
      if(sql===MISSING_SOURCE_IDS_SQL)return {rows:[{missing_count:missingCount}]};
      if(sql.includes('INSERT INTO public.iniziative_ministero'))
        return {rowCount:upsertCount};
      if(sql.includes('INSERT INTO public.civic_new_initiative_notifications'))
        return {rowCount:suppressedCount};
      if(sql.includes('SELECT (SELECT count(*)::integer FROM public.civic_new_initiative_notifications'))
        return {rows:[{actionable:0,blocked:guard}]};
      return {rows:[]};
    },
    release(discard){released=discard;},
  };
  const pool={connect:async()=>client,end:async()=>{ended++;}};
  return {pool,calls,get released(){return released;},get ended(){return ended;}};
}
const safeTestOptions=(db,rows=[makeRow(217),makeRow(218)])=>({
  validateEnv:()=> 'postgresql://fake-ci-only',
  makePool:()=>db.pool,verifyIdentity:async()=>true,
  readSource:async()=>rows,
});

test('separate staging source GO is required even before loading pg or fetching source',()=>{
  assert.throws(()=>assertSourceSyncEnv({NODE_ENV:'staging'}),
    /MINISTERO_SOURCE_SYNC_GO_REQUIRED/);
  assert.throws(()=>assertSourceSyncEnv({
    NODE_ENV:'production',
    DEMOS_STAGING_MINISTERO_SOURCE_SYNC_GO:
      'I_APPROVE_STAGING_MINISTERO_SOURCE_SYNC',
  }),/MINISTERO_SOURCE_SYNC_GO_REQUIRED/);
});
test('pure normalization keeps only selected public columns, never raw payload',()=>{
  const row=prepareRows([makeRow()])[0];
  assert.equal(row.id,'ministero_217');
  assert.equal(row.quorum_raggiunto,true);
  assert.equal(row.data_fine,'2027-05-01');
  assert.equal(row.dati_raw,undefined);
  const referendum=prepareRows([makeRow(218,'Public referendum','Referendum abrogativo')])[0];
  assert.equal(referendum.categoria,'referendum_abrogativi');
  assert.equal(referendum.quorum_raggiunto,false);
  const sentinel=makeRow(219);sentinel.data_fine_raw='9999-12-31';
  assert.equal(prepareRows([sentinel])[0].data_fine,null);
});
test('reject duplicate, missing IDs, invalid dates, categories, signatures, URLs',()=>{
  assert.throws(()=>prepareRows([makeRow(),makeRow()]),/MINISTERO_SOURCE_INVALID_ID/);
  for(const bad of [
    {...makeRow(),id_ministero:'217 OR 1=1'},
    {...makeRow(),titolo:''},
    {...makeRow(),stato:'UNKNOWN'},
    {...makeRow(),data_fine_raw:'2026-02-30'},
    {...makeRow(),categoria_notifica:'eci'},
    {...makeRow(),firme_raccolte:-1},
    {...makeRow(),sito_web:'http://fake.example'},
  ])assert.throws(()=>prepareRows([bad]),/MINISTERO_SOURCE_/);
  assert.throws(()=>prepareRows([]),/MINISTERO_SOURCE_COUNT_UNSAFE/);
  assert.throws(()=>prepareRows(Array.from({length:101},(_,i)=>makeRow(i+1))),
    /MINISTERO_SOURCE_COUNT_UNSAFE/);
});
test('updates both IDs atomically and adds only suppressed historic events',async()=>{
  const db=fakeDatabase();
  const result=await syncOnce({},safeTestOptions(db));
  assert.deepEqual(result,{
    source:2,updated:2,newlySuppressed:1,notificationsSent:0,stagingOnly:true,
  });
  const q=db.calls.map(x=>x.sql);
  assert.equal(q[0],'BEGIN');
  assert.ok(q.some(s=>s.includes('FOR SHARE')));
  assert.ok(q.some(s=>s.includes('ON CONFLICT (id) DO UPDATE SET')));
  assert.ok(q.some(s=>s.includes("'suppressed'")));
  assert.equal(q.at(-1),'COMMIT');
  assert.equal(db.released,false);
  assert.equal(db.ended,1);
  assert.doesNotMatch(UPSERT_SQL,/DELETE|TRUNCATE|dati_raw/);
  assert.doesNotMatch(BASELINE_SQL,/pending|sent|firebase|DELETE/);
  const payload=db.calls.find(x=>x.sql===UPSERT_SQL).params[0];
  const parsed=JSON.parse(payload);
  assert.equal(parsed.length,2);
  assert.equal(parsed[0].id_ministero,'217');
  assert.equal(parsed[1].id_ministero,'218');
});
test('first-run source with missing baseline is not allowed to write',async()=>{
  const db=fakeDatabase({oldCount:0});
  await assert.rejects(syncOnce({},safeTestOptions(db)),/MINISTERO_SOURCE_SYNC_ABORTED/);
  assert.equal(db.calls.some(x=>x.sql===UPSERT_SQL),false);
  assert.equal(db.calls.at(-1).sql,'ROLLBACK');
  assert.equal(db.released,true);
});
test('delivery guard false and stale feed fail before writes and discard connection',async()=>{
  for(const settings of [{guard:false},{missingCount:1},{actionable:1},{lock:false}]){
    const db=fakeDatabase(settings);
    await assert.rejects(syncOnce({},safeTestOptions(db)),
      /MINISTERO_SOURCE_SYNC_ABORTED/);
    assert.equal(db.calls.some(x=>x.sql===UPSERT_SQL),false);
    assert.equal(db.calls.at(-1).sql,'ROLLBACK');
    assert.equal(db.released,true);
    assert.equal(db.ended,1);
  }
});
test('identity failure fails before source fetch, no DB writes',async()=>{
  const db=fakeDatabase({role:'postgres'});
  let fetched=0;
  await assert.rejects(syncOnce({},{
    ...safeTestOptions(db),
    readSource:async()=>{fetched++;return [makeRow()]},
  }),/MINISTERO_SOURCE_SYNC_ABORTED/);
  assert.equal(db.calls.some(x=>x.sql===UPSERT_SQL),false);
  assert.equal(db.calls.at(-1).sql,'ROLLBACK');
  assert.equal(fetched,1); // Pre-connect identity gate succeeded before fetch.
});
test('provider SQL errors never leak credentials and always roll back',async()=>{
  const db=fakeDatabase({failAt:'INSERT INTO public.iniziative_ministero'});
  await assert.rejects(syncOnce({},safeTestOptions(db)),e=>
    e.message==='MINISTERO_SOURCE_SYNC_ABORTED' &&
    !e.message.includes('provider-password'));
  assert.equal(db.calls.at(-1).sql,'ROLLBACK');
  assert.equal(db.released,true);
  assert.equal(db.ended,1);
});

// A source with the same number of rows can still omit an existing official ID.
// The old 80%-of-count gate incorrectly accepted this case.
test('same-size source with a missing archived official ID aborts before all writes',async()=>{
  const db=fakeDatabase({oldCount:2,missingCount:1});
  await assert.rejects(syncOnce({},safeTestOptions(db)),
    /MINISTERO_SOURCE_SYNC_ABORTED/);
  const check=db.calls.find(call=>call.sql===MISSING_SOURCE_IDS_SQL);
  assert.ok(check,'source ID coverage query must run');
  assert.equal(JSON.parse(check.params[0]).length,2);
  assert.equal(db.calls.some(call=>call.sql===UPSERT_SQL),false);
  assert.equal(db.calls.some(call=>call.sql===BASELINE_SQL),false);
  assert.equal(db.calls.at(-1).sql,'ROLLBACK');
});

test('unknown or missing coverage result also fails closed',async()=>{
  for(const missingCount of [null,'0',-1]){
    const db=fakeDatabase({missingCount});
    await assert.rejects(syncOnce({},safeTestOptions(db)),
      /MINISTERO_SOURCE_SYNC_ABORTED/);
    assert.equal(db.calls.some(call=>call.sql===UPSERT_SQL),false);
  }
});
