'use strict';
// Offline fake-DB checks. No service, network, real users or FCM tokens.
const test=require('node:test');
const assert=require('node:assert/strict');
const {getLegacyTokens,updateLegacyTokens}=require('../services/civicLegacyFcmStorage');

test('absent legacy column is a successful schema read, never a SQL 42703',async()=>{
  let sql='';
  const db={query:async(q,values)=>{
    sql=q;assert.deepEqual(values,['synthetic-user']);
    return {rows:[{legacy_column_present:false,fcm_tokens:[]}]};
  }};
  assert.deepEqual(await getLegacyTokens('synthetic-user',db),
    {tokens:[],hasColumn:false});
  assert.match(sql,/to_jsonb\(u\)/);
  assert.doesNotMatch(sql,/COALESCE\(fcm_tokens/);
});

test('optional legacy writer skips SQL entirely if column is absent',async()=>{
  let calls=0;
  const db={query:async()=>{calls++;throw Error('SQL MUST NOT RUN');}};
  assert.equal(await updateLegacyTokens('synthetic-user',[],db,false),false);
  assert.equal(calls,0);
});

test('existing column still reads and updates one user, never silently losing writes',async()=>{
  const statements=[];
  const db={query:async(q,values)=>{
    statements.push({q,values});
    if(q.includes('SELECT'))return {rows:[{
      legacy_column_present:true,
      fcm_tokens:['synthetic_a','synthetic_b'],
    }]};
    return {rowCount:1};
  }};
  const state=await getLegacyTokens('synthetic-user',db);
  assert.deepEqual(state.tokens,['synthetic_a','synthetic_b']);
  assert.equal(await updateLegacyTokens('synthetic-user',['synthetic_a'],db,state.hasColumn),true);
  assert.deepEqual(statements[1].values,[['synthetic_a'],'synthetic-user']);
});

test('missing user, invalid schema responses and missing update ack fail closed',async()=>{
  const db={query:async()=>({rows:[]})};
  assert.equal(await getLegacyTokens('missing-user',db),null);
  await assert.rejects(getLegacyTokens('synthetic-user',{
    query:async()=>({rows:[{fcm_tokens:[]}]}),
  }),/CIVIC_LEGACY_FCM_SCHEMA_UNCONFIRMED/);
  await assert.rejects(getLegacyTokens('synthetic-user',{
    query:async()=>({rows:[{legacy_column_present:false,fcm_tokens:null}]}),
  }),/CIVIC_LEGACY_FCM_SCHEMA_UNCONFIRMED/);
  await assert.rejects(updateLegacyTokens('synthetic-user',[],{
    query:async()=>({rowCount:0}),
  },true),/CIVIC_LEGACY_FCM_UPDATE_UNCONFIRMED/);
});
