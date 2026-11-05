'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const ROOT = path.resolve(__dirname, '..', '..');
const file = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

function loadJob({ result = {created:1, updated:4, errors:0},
  fails = false, recorded = 1 } = {}) {
  const calls = {sync:0, collect:0, push:0};
  const module = {exports:{}};
  vm.runInNewContext(file('api/jobs/ministeroSyncJob.js'), {
    module, exports:module.exports, process:{env:{}},
    require(p) {
      if (p==='../services/ministeroSync') return {syncAll:async()=>{
        calls.sync++;
        if (fails) throw new Error('private source details');
        return result;
      }};
      if (p==='../services/centralizedLogger') return {error:async()=>{}};
      if (p==='../services/civicNewInitiativeEventCollector') {
        return {collectMinisteroNewInitiatives:async()=>{calls.collect++;return {recorded};}};
      }
      if (p==='../services/civicNewInitiativePushDispatcher') {
        return {dispatchCivicNewInitiatives:async()=>{calls.push++;throw Error('UNEXPECTED_FCM');}};
      }
      if (p==='../config/database') return {getPool:()=>({query:async()=>{}})};
      throw new Error('unexpected import: '+p);
    },
    console:{log(){},warn(){},error(){}},
    Date, Number, Error, setTimeout, setInterval, clearInterval,
  });
  return {job:module.exports,calls};
}

test('signed scheduler validates complete source, collects once, never sends FCM',async()=>{
  const {job,calls}=loadJob();
  const outcome=await job.executeSignedCivicSync();
  assert.equal(outcome.complete,true);
  assert.equal(outcome.processed,5);
  assert.equal(outcome.eventsRecorded,1);
  assert.equal(job.lastSyncStatus,'success');
  assert.deepEqual(calls,{sync:1,collect:1,push:0});
});

test('partial, zero-row, invalid, and broken source never creates events',async()=>{
  for(const result of [
    {created:0,updated:0,errors:0},
    {created:1,updated:1,errors:1},
    {created:0,updated:0,errors:3},
    {created:NaN,updated:1,errors:0},
    {created:-1,updated:1,errors:0},
  ]){
    const {job,calls}=loadJob({result});
    await assert.rejects(job.executeSignedCivicSync(),e=>e.message==='MINISTERO_SCHEDULED_SYNC_FAILED');
    assert.equal(job.lastSyncStatus,'error');
    assert.equal(job.isRunning,false);
    assert.equal(calls.collect,0);
    assert.equal(calls.push,0);
  }
  const {job,calls}=loadJob({fails:true});
  await assert.rejects(job.executeSignedCivicSync(),e=>!e.message.includes('private source details'));
  assert.equal(calls.collect,0);
});

test('running full or quick sync returns busy and triggers no concurrent source fetch',async()=>{
  for(const busyField of ['isRunning','isRunningInCorso']){
    const {job,calls}=loadJob();
    job[busyField]=true;
    const result=await job.executeSignedCivicSync();
    assert.equal(result.busy,true);
    assert.equal(calls.sync,0);
    assert.equal(calls.collect,0);
  }
});

function loadRoute(env, outcome={complete:true,processed:5,eventsRecorded:1}) {
  const handlers={};
  const module={exports:{}};
  const requireMap={
    'node:crypto':require('node:crypto'),
    express:{Router:()=>({
      post(path,handler){handlers[path]=handler;},
    })},
    '../config/database':{getPool:()=>({})},
    '../services/civicPushTopics':{isCivicPushEnabled:()=>false},
    '../services/civicNewInitiativePushDispatcher':{
      dispatchCivicNewInitiatives:async()=>{throw Error('UNEXPECTED_FCM');},
    },
    '../jobs/ministeroSyncJob':{
      executeSignedCivicSync:async()=>{
        if(outcome instanceof Error)throw outcome;
        return outcome;
      },
    },
  };
  vm.runInNewContext(file('api/routes/civicPushDispatch.js'),{
    module,exports:module.exports,Buffer,
    process:{env},
    require(p){if(!Object.hasOwn(requireMap,p))throw Error(p);return requireMap[p];},
  });
  return handlers['/sync-ministero'];
}
function response(){
  return {code:200,data:null,status(value){this.code=value;return this;},
    json(value){this.data=value;return this;}};
}
const SECRET='ci-fake-only-key-0123456789-ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const request = key=>({headers:{'x-civic-ministero-sync-key':key}});
test('private scheduler endpoint defaults disabled, requires separate signed key',async()=>{
  let res=response();
  await loadRoute({})(request(SECRET),res);
  assert.equal(res.code,503);
  assert.equal(res.data.error,'CIVIC_MINISTERO_SYNC_DISABLED');

  res=response();
  await loadRoute({CIVIC_MINISTERO_SYNC_TRIGGER_ENABLED:'true',
    CIVIC_MINISTERO_SYNC_KEY:SECRET})(request('short'),res);
  assert.equal(res.code,401);

  res=response();
  await loadRoute({CIVIC_MINISTERO_SYNC_TRIGGER_ENABLED:'true',
    CIVIC_MINISTERO_SYNC_KEY:SECRET})(request(SECRET),res);
  assert.equal(res.code,200);
  assert.equal(res.data.eventsRecorded,1);
});

test('busy or failed sync does not claim success or expose errors',async()=>{
  for(const [outcome,status] of [[{busy:true},409],[new Error('SECRET SQL info'),503]]){
    const handler=loadRoute({
      CIVIC_MINISTERO_SYNC_TRIGGER_ENABLED:'true',
      CIVIC_MINISTERO_SYNC_KEY:SECRET,
    },outcome);
    const res=response();
    await handler(request(SECRET),res);
    assert.equal(res.code,status);
    assert.equal(res.data.success,false);
    assert.ok(!JSON.stringify(res.data).includes('SECRET SQL info'));
  }
});

test('GitHub Actions schedule is explicit opt-in and never dispatches Firebase',()=>{
  const yaml=file('.github/workflows/civic-ministero-sync.yml');
  assert.match(yaml,/CIVIC_MINISTERO_SCHEDULER_ENABLED == 'true'/);
  assert.match(yaml,/secrets\.CIVIC_MINISTERO_SYNC_URL/);
  assert.match(yaml,/secrets\.CIVIC_MINISTERO_SYNC_KEY/);
  assert.match(yaml,/--fail --silent --show-error/);
  assert.doesNotMatch(yaml,/sendEachForMulticast|firebase-admin|CIVIC_PUSH_DISPATCH_URL/);
});
