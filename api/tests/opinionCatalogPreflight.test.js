'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {checkOpinionCatalogParity}=require('../scripts/checkOpinionCatalogParity');
const {getAllOpinions}=require('../services/opinionCatalog');
const questions=getAllOpinions();

function fakePool({missing=null,wrongType=null,extra=null,legacyDrift=false}={}){
  const calls=[];
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
  return {calls,async query(sql){
    calls.push(sql);
    if(sql.includes('information_schema.columns'))return {rows:columns};
    if(sql.includes('FROM public.opinioni_domande'))return {rows:legacy};
    throw Error('Unexpected query '+sql);
  }};
}

test('first cutover checks 94 source entries AND every TEXT answer column in read-only mode',async()=>{
  const pool=fakePool();
  const result=await checkOpinionCatalogParity(pool);
  assert.deepEqual(result,{published:94,checkedColumns:94,mode:'initial-cutover'});
  assert.equal(pool.calls.length,2);
  assert.ok(pool.calls.every(sql=>/^\s*SELECT\s/i.test(sql)));
  assert.ok(pool.calls.every(sql=>!/\b(users|user_consents)\b/.test(sql)));
  assert.ok(pool.calls.every(sql=>!/\b(?:INSERT|UPDATE|DELETE|ALTER|DROP|TRUNCATE)\b/i.test(sql)));
});

test('missing answer columns fail before reading legacy table',async()=>{
  const pool=fakePool({missing:questions[0].id});
  await assert.rejects(checkOpinionCatalogParity(pool),/Missing answer columns:/);
  assert.equal(pool.calls.length,1);
});

test('a non-TEXT opinion answer column fails before cutover',async()=>{
  const pool=fakePool({wrongType:questions[1].id});
  await assert.rejects(checkOpinionCatalogParity(pool),/Non-text answer columns:/);
  assert.equal(pool.calls.length,1);
});

test('unexpected answer column fails initial cutover but is preserved in schema-only mode',async()=>{
  const pool=fakePool({extra:'archived_legacy_answer'});
  await assert.rejects(checkOpinionCatalogParity(pool),/Unexpected answer columns/);
  const check=await checkOpinionCatalogParity(pool,{schemaOnly:true});
  assert.equal(check.checkedColumns,94);
  assert.equal(check.mode,'schema-only');
  assert.equal(pool.calls.filter(x=>x.includes('FROM public.opinioni_domande')).length,0);
});

test('changed legacy text fails initial cutover but not later schema-only releases',async()=>{
  const pool=fakePool({legacyDrift:true});
  await assert.rejects(checkOpinionCatalogParity(pool),/Catalog drift IDs:/);
  assert.equal((await checkOpinionCatalogParity(pool,{schemaOnly:true})).published,94);
});
