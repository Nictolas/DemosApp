'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {buildCivicPush} = require('../services/civicNewInitiativePushDispatcher');
const {assertCanaryEnvironment,verifyPayloads,createServer} =
  require('../staging/civic_d6_contract_canary');

const safe = Object.freeze({
  NODE_ENV:'staging',CIVIC_D6_CONTRACT_ONLY:'true',
  CIVIC_PUSH_ENABLED:'false',CIVIC_NEW_INITIATIVE_EVENTS_ENABLED:'false',
  CIVIC_NEW_INITIATIVE_PUSH_ENABLED:'false',
});

test('contract canary rejects credentials, production and live FCM flags',()=>{
  assert.equal(assertCanaryEnvironment(safe),true);
  const forbidden = [
    {NODE_ENV:'production'},
    {CIVIC_D6_CONTRACT_ONLY:'false'},
    {CIVIC_PUSH_ENABLED:'true'},
    {CIVIC_NEW_INITIATIVE_PUSH_ENABLED:'1'},
    {DATABASE_URL:'postgres://secret'},
    {FIREBASE_SERVICE_ACCOUNT_JSON:'not-for-qa'},
    {CIVIC_STAGING_SESSION_DATABASE_URL:'postgres://stage'},
    {SUPABASE_SERVICE_ROLE_KEY:'forbidden'},
  ];
  for (const change of forbidden)
    assert.throws(()=>assertCanaryEnvironment({...safe,...change}), /D6_CANARY_/);
});

test('production payload builder validates 3 real civic categories without send',()=>{
  assert.equal(verifyPayloads(buildCivicPush),true);
  assert.throws(()=>verifyPayloads(()=>({})),/D6_CIVIC_PAYLOAD_CONTRACT_FAILED/);
});

test('only synthetic no-DB/no-FCM health endpoints are exposed',async t=>{
  const server=createServer(safe,{builder:buildCivicPush});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const root='http://127.0.0.1:'+server.address().port;
  const health=await fetch(root+'/health');
  assert.equal(health.status,200);
  assert.deepEqual(await health.json(),{
    status:'civic_d6_contract_canary',app_ready:false,
    database_connected:false,notifications_enabled:false,
  });
  const contracts=await fetch(root+'/health/contracts');
  assert.equal(contracts.status,200);
  assert.deepEqual(await contracts.json(),{
    status:'synthetic_contracts_passed',categories_verified:3,
    db_reads:0,fcm_sends:0,release_ready:false,
  });
  for (const route of ['/api/eci','/api/fcm-tokens','/api/civic-push',
    '/health/contracts?token=bad','//health/contracts','/health/ready']) {
    assert.equal((await fetch(root+route)).status,404,route);
  }
  assert.equal((await fetch(root+'/health',{method:'POST',body:'{}'})).status,404);
  const head=await fetch(root+'/health/contracts',{method:'HEAD'});
  assert.equal(head.status,200);
  assert.equal(await head.text(),'');
});
