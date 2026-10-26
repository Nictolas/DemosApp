'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('supporter push query budget is linear: two lookups plus one fresh consent check per token', async () => {
  // Fully in-memory measurement of SQL round trips, NOT a database latency or
  // Firebase benchmark. No external provider is contacted and no credentials
  // are required. Single-test module cache injection restores the stub.
  const firebasePath=require.resolve('../services/firebaseAdmin');
  const servicePath=require.resolve('../services/currentSupporterPushService');
  const firebase=require(firebasePath);
  const oldGet=firebase.getFirebaseAdmin;
  const delivered=[];
  firebase.getFirebaseAdmin=()=>({
    messaging:()=>({send:async ({token})=>{delivered.push(token);}})
  });
  delete require.cache[servicePath];

  try {
    const {sendPushToCurrentSupporters}=require(servicePath);
    for (const size of [1,10,100]) {
      delivered.length=0;
      let supporterReads=0;
      let initialTokenReads=0;
      let freshConsentReads=0;
      const expectedTokens=Array.from({length:size},(_,i)=>'synthetic-token-'+i);
      const db={async query(sql,params){
        const statement=String(sql);
        if (statement.includes('FROM public.political_selections ps')) {
          supporterReads++;
          return {rows:[{id:'00000000-0000-4000-8000-000000000501'}]};
        }
        if (statement.includes('ARRAY(')&&statement.includes('FROM public.users u')) {
          initialTokenReads++;
          assert.match(statement,/u\.id = ANY\(\$1::uuid\[\]\)/);
          return {rows:[{
            id:'00000000-0000-4000-8000-000000000501',
            fcm_tokens:expectedTokens
          }]};
        }
        if (statement.startsWith('SELECT EXISTS')&&statement.includes('FROM public.users u')) {
          freshConsentReads++;
          assert.match(statement,/u\.id = ANY\(\$1::uuid\[\]\)/);
          assert.deepEqual(params[0],['00000000-0000-4000-8000-000000000501']);
          assert.equal(params[1],expectedTokens[freshConsentReads-1]);
          return {rows:[{eligible:true}]};
        }
        throw Error('Unexpected synthetic query');
      }};
      const result=await sendPushToCurrentSupporters(db,{
        subjectUserId:'00000000-0000-4000-8000-000000000500',
        kind:'representative',level:'CAMERA',
        title:'synthetic',body:'offline fixture'
      });
      assert.deepEqual(delivered,expectedTokens);
      assert.equal(supporterReads,1);
      assert.equal(initialTokenReads,1);
      assert.equal(freshConsentReads,size);
      assert.equal(supporterReads+initialTokenReads+freshConsentReads,size+2,
        'must not grow quadratically or silently omit pre-send checks');
      assert.deepEqual(result,{
        targetedUsers:1,tokens:size,sent:size,failed:0,skipped:0,firebaseAvailable:true
      });
    }
  } finally {
    firebase.getFirebaseAdmin=oldGet;
    delete require.cache[servicePath];
  }
});
