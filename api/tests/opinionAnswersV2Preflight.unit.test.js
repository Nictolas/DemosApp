'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {inspectLegacyOpinionAnswerSchema,SCHEMA_SQL}=
  require('../experiments/opinionAnswersV2PreflightCandidate');
const ids=Array.from({length:94},(_,i)=>'opinione_'+i);
const metadata=[
  {column_name:'user_id',data_type:'uuid'},
  ...ids.map(id=>({column_name:id,data_type:'text'})),
  {column_name:'fonti_opinioni',data_type:'jsonb'}
];

test('one metadata SELECT only; no catalog/user answers queried',async()=>{
  const statements=[];
  const db={query:async sql=>{
    statements.push(sql);
    return {rows:metadata};
  }};
  const outcome=await inspectLegacyOpinionAnswerSchema(db,ids);
  assert.deepEqual(outcome,{
    checkedAnswerColumns:94,checkedServiceColumns:2,
    catalogReadFromSql:false,personalAnswersRead:false,
    schemaChangesMade:false
  });
  assert.equal(statements.length,1);
  assert.equal(statements[0],SCHEMA_SQL);
  assert.match(statements[0],/FROM information_schema\.columns/);
  assert.doesNotMatch(statements[0],/FROM\s+(?:public\.)?(?:users|opinioni_risposte|opinioni_domande)\b/i);
  assert.doesNotMatch(statements[0],/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i);
});

test('published catalog missing archived ID is rejected without copying',async()=>{
  const schemaWithArchived=[...metadata,{column_name:'opinione_archived',data_type:'text'}];
  let count=0;
  await assert.rejects(
    inspectLegacyOpinionAnswerSchema({query:async()=>{count++;return{rows:schemaWithArchived};}},ids),
    /historical ID manifest/
  );
  assert.equal(count,1);
  const historical=[...ids,'opinione_archived'];
  const outcome=await inspectLegacyOpinionAnswerSchema(
    {query:async()=>({rows:schemaWithArchived})},historical
  );
  assert.equal(outcome.checkedAnswerColumns,95);
});

test('invalid schema types, missing responses, missing manifest and connection rejected',async()=>{
  const db={query:async()=>({rows:metadata})};
  await assert.rejects(inspectLegacyOpinionAnswerSchema(db,[]),/historical ID manifest/);
  await assert.rejects(inspectLegacyOpinionAnswerSchema({},ids),/query interface/);
  await assert.rejects(inspectLegacyOpinionAnswerSchema(
    {query:async()=>({rows:metadata.filter(x=>x.column_name!=='opinione_93')})},ids
  ),/historical ID manifest/);
  await assert.rejects(inspectLegacyOpinionAnswerSchema(
    {query:async()=>({rows:metadata.map(x=>x.column_name==='opinione_23'?{...x,data_type:'boolean'}:x)})},ids
  ),/Non-TEXT/);
});
