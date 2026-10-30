'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {checkOpinionCatalogParity}=require('../scripts/checkOpinionCatalogParity');
const {getAllOpinions}=require('../services/opinionCatalog');
const questions=getAllOpinions();
const BEGIN='BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY';

// Fake transactional client: there is deliberately NO pool.query fallback.
// The cutover verifier must keep both metadata reads on one read-only client.
function fakePool({missing=null,wrongType=null,extra=null,legacyDrift=false,
  failMetadata=false,failBegin=false,failRollback=false}={}){
  const calls=[],releases=[];
  const columns=questions.filter(x=>x.id!==missing).map(x=>({
    column_name:x.id,data_type:x.id===wrongType?'integer':'text'
  }));
  columns.push({column_name:'user_id',data_type:'uuid'});
  columns.push({column_name:'fonti_opinioni',data_type:'jsonb'});
  if(extra)columns.push({column_name:extra,data_type:'text'});
  const legacy=questions.map(q=>({
    id:q.id,text:legacyDrift && q.id===questions[0].id?'CHANGED TEXT':q.text,
    gradi_opinione:[...q.gradi_opinione],approfondimento:q.approfondimento
  }));
  const client={async query(sql){
    calls.push(sql);
    if(sql===BEGIN){
      if(failBegin)throw Error('synthetic BEGIN failed');
      return {rows:[]};
    }
    if(sql==='COMMIT')return {rows:[]};
    if(sql==='ROLLBACK'){
      if(failRollback)throw Error('synthetic ROLLBACK failed');
      return {rows:[]};
    }
    if(sql.includes('information_schema.columns')){
      if(failMetadata)throw Error('synthetic metadata failure');
      return {rows:columns};
    }
    if(sql.includes('FROM public.opinioni_domande'))return {rows:legacy};
    throw Error('Unexpected query '+sql);
  },release(damaged=false){releases.push(damaged);}};
  return {calls,releases,async connect(){return client;},
    async query(){throw Error('pool.query is not allowed in cutover preflight');}};
}

test('first cutover compares schema and legacy entries in one read-only RR snapshot',async()=>{
  const pool=fakePool();
  const result=await checkOpinionCatalogParity(pool);
  assert.deepEqual(result,{published:questions.length,
    checkedColumns:questions.length,mode:'initial-cutover'});
  assert.equal(pool.calls.length,4);
  assert.equal(pool.calls[0],BEGIN);
  assert.equal(pool.calls.at(-1),'COMMIT');
  const selects=pool.calls.slice(1,-1);
  assert.equal(selects.length,2);
  assert.ok(selects.every(sql=>/^\s*SELECT\s/i.test(sql)));
  assert.ok(selects.every(sql=>!/\b(users|user_consents)\b/.test(sql)));
  assert.ok(pool.calls.every(sql=>!/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i.test(sql)));
  assert.deepEqual(pool.releases,[false],'return healthy client only after COMMIT');
});

test('missing answer columns roll back before reading the legacy table',async()=>{
  const pool=fakePool({missing:questions[0].id});
  await assert.rejects(checkOpinionCatalogParity(pool),/Missing answer columns:/);
  assert.deepEqual(pool.calls.map(sql=>sql===BEGIN?'BEGIN':sql==='ROLLBACK'?'ROLLBACK':'SELECT'),
    ['BEGIN','SELECT','ROLLBACK']);
  assert.deepEqual(pool.releases,[false]);
});

test('non-TEXT opinion answer columns fail and always roll back',async()=>{
  const pool=fakePool({wrongType:questions[1].id});
  await assert.rejects(checkOpinionCatalogParity(pool),/Non-text answer columns:/);
  assert.equal(pool.calls.at(-1),'ROLLBACK');
  assert.deepEqual(pool.releases,[false]);
});

test('unexpected answer column fails cutover but is preserved in later schema-only releases',async()=>{
  const pool=fakePool({extra:'archived_legacy_answer'});
  await assert.rejects(checkOpinionCatalogParity(pool),/Unexpected answer columns/);
  const check=await checkOpinionCatalogParity(pool,{schemaOnly:true});
  assert.equal(check.checkedColumns,questions.length);
  assert.equal(check.mode,'schema-only');
  assert.equal(pool.calls.filter(x=>x.includes('FROM public.opinioni_domande')).length,0);
  assert.equal(pool.calls.filter(x=>x===BEGIN).length,2);
  assert.equal(pool.calls.filter(x=>x==='ROLLBACK').length,1);
  assert.equal(pool.calls.filter(x=>x==='COMMIT').length,1);
  assert.deepEqual(pool.releases,[false,false]);
});

test('changed legacy text fails first cutover but not later schema-only releases',async()=>{
  const pool=fakePool({legacyDrift:true});
  await assert.rejects(checkOpinionCatalogParity(pool),/Catalog drift IDs:/);
  assert.equal(pool.calls.at(-1),'ROLLBACK');
  assert.equal((await checkOpinionCatalogParity(pool,{schemaOnly:true})).published,
    questions.length);
  assert.equal(pool.calls.at(-1),'COMMIT');
});

test('SQL metadata failure is not reported as a passing catalog and rolls back',async()=>{
  const pool=fakePool({failMetadata:true});
  await assert.rejects(checkOpinionCatalogParity(pool),/synthetic metadata failure/);
  assert.equal(pool.calls.at(-1),'ROLLBACK');
  assert.deepEqual(pool.releases,[false]);
});

test('a failed BEGIN never performs any metadata read and discards connection',async()=>{
  const pool=fakePool({failBegin:true});
  await assert.rejects(checkOpinionCatalogParity(pool),/synthetic BEGIN failed/);
  assert.deepEqual(pool.calls,[BEGIN]);
  assert.deepEqual(pool.releases,[true]);
});

test('failed ROLLBACK discards damaged connection and preserves original error',async()=>{
  const pool=fakePool({failMetadata:true,failRollback:true});
  await assert.rejects(checkOpinionCatalogParity(pool),/synthetic metadata failure/);
  assert.equal(pool.calls.at(-1),'ROLLBACK');
  assert.deepEqual(pool.releases,[true]);
});

test('nontransactional adapters are refused, not silently used for independent reads',async()=>{
  let calls=0;
  await assert.rejects(checkOpinionCatalogParity({async query(){calls++;}}),
    /transaction-capable PostgreSQL pool/);
  assert.equal(calls,0);
});
