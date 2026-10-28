'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const Module=require('node:module');
// Installed by the existing frontend CI job. Compile the actual standalone
// client helper in memory; no network, database, browser or generated files.
const ts=require('../../client/node_modules/typescript');
const sourcePath=path.resolve(__dirname,'../../client/src/lib/gdprRightsSubmission.ts');
const compiled=ts.transpileModule(fs.readFileSync(sourcePath,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}
}).outputText;
const clientModule=new Module(sourcePath,module);
clientModule._compile(compiled,sourcePath);
const {createGdprRightsSubmission}=clientModule.exports;

const keys=[
  '832406fb-940a-47f1-8777-c04736af9260',
  '9fbd482c-fc0f-4a29-9dad-e5691bd2ac3a',
  'fe92609a-5b4f-4566-8543-c3242f927000'
];
const ack=(key,replayed=false)=>({async json(){
  return {success:true,request_id:key,...(replayed?{replayed:true,data:null}:{})};
}});

test('existing limitation action uses PUT, canonical payload and parsed receipt',async()=>{
  const calls=[];
  const submission=createGdprRightsSubmission(async(...args)=>{
    calls.push(args);return ack(args[3]['Idempotency-Key']);
  },()=>keys[0]);
  const selected=['political_opinions','personal_data'];
  const result=await submission.limit(selected);
  assert.deepEqual(calls,[['PUT','/api/user/limit-processing',{
    limited:true,categories:['personal_data','political_opinions'],reason:null
  },{'Idempotency-Key':keys[0]}]]);
  assert.deepEqual(selected,['political_opinions','personal_data']);
  assert.deepEqual(result,{requestId:keys[0],replayed:false});
});

test('lost response retries same action/key and handles replay without claiming current state',async()=>{
  const calls=[];let generated=0;
  const submission=createGdprRightsSubmission(async(...args)=>{
    calls.push(args);
    if(calls.length===1) throw Error('synthetic response lost after commit');
    return ack(args[3]['Idempotency-Key'],true);
  },()=>keys[generated++]);
  await assert.rejects(submission.limit(['voting_data','personal_data']));
  const receipt=await submission.limit(['personal_data','voting_data']);
  assert.equal(generated,1);
  assert.deepEqual(calls[0],calls[1]);
  assert.deepEqual(receipt,{requestId:keys[0],replayed:true});
  assert.equal('data' in receipt,false);
  await submission.limit(['personal_data','voting_data']);
  assert.equal(calls[2][3]['Idempotency-Key'],keys[1],
    'a new explicit action after acknowledgment receives a new key');
});

test('objection trims reason and keeps private input only in its per-form retry state',async()=>{
  const calls=[];let generated=0;
  const submission=createGdprRightsSubmission(async(...args)=>{
    calls.push(args);
    if(calls.length===1) throw Error('synthetic timeout');
    return ack(args[3]['Idempotency-Key'],true);
  },()=>keys[generated++]);
  await assert.rejects(submission.object(['communication_data'],'  synthetic reason  '));
  await submission.object(['communication_data'],'synthetic reason');
  assert.deepEqual(calls[0],calls[1]);
  assert.deepEqual(calls[0].slice(0,3),['POST','/api/user/object',{
    categories:['communication_data'],reason:'synthetic reason'
  }]);
  assert.equal(generated,1);
  assert.equal(fs.readFileSync(sourcePath,'utf8').includes('localStorage'),false);
  assert.equal(fs.readFileSync(sourcePath,'utf8').includes('sessionStorage'),false);
});

test('changed payload and another account form never inherit an uncertain request key',async()=>{
  const calls=[];let generated=0;
  const send=async(...args)=>{calls.push(args);throw Error('synthetic timeout');};
  const newId=()=>keys[generated++];
  const first=createGdprRightsSubmission(send,newId);
  await assert.rejects(first.object(['technical_data'],'reason one'));
  await assert.rejects(first.object(['technical_data'],'reason two'));
  const anotherAccount=createGdprRightsSubmission(send,newId);
  await assert.rejects(anotherAccount.object(['technical_data'],'reason two'));
  assert.deepEqual(calls.map(args=>args[3]['Idempotency-Key']),keys);
});

test('synchronous repeated clicks send one request while changed input waits',async()=>{
  let release;let calls=0;
  const submission=createGdprRightsSubmission(async(_method,_path,_body,headers)=>{
    calls++;
    await new Promise(resolve=>{release=resolve;});
    return ack(headers['Idempotency-Key']);
  },()=>keys[0]);
  const first=submission.limit(['personal_data']);
  const second=submission.limit(['personal_data']);
  assert.equal(first,second);
  assert.equal(calls,1);
  await assert.rejects(submission.limit(['technical_data']),/IN_FLIGHT/);
  release();
  await first;
});

test('unverified receipt is never success and preserves key for explicit retry',async()=>{
  for(const invalid of [null,{}, {success:true},
    {success:true,request_id:keys[1]},
    {success:true,request_id:keys[0],replayed:'yes'}]) {
    let calls=0;let generated=0;
    const submission=createGdprRightsSubmission(async(_m,_p,_b,headers)=>{
      calls++;
      return calls===1 ? {async json(){return invalid;}} : ack(headers['Idempotency-Key']);
    },()=>keys[generated++]);
    await assert.rejects(submission.object(['political_opinions'],'synthetic'),/UNVERIFIED/);
    assert.deepEqual(await submission.object(['political_opinions'],'synthetic'),{
      requestId:keys[0],replayed:false
    });
    assert.equal(generated,1);
  }
});

test('invalid categories/reason cannot reach transport or manufacture a receipt',async()=>{
  let calls=0;
  const submission=createGdprRightsSubmission(async()=>{calls++;},()=>keys[0]);
  for(const categories of [[],['personal'],['personal_data','personal_data']]) {
    assert.throws(()=>submission.limit(categories),/CATEGORIES_INVALID/);
  }
  await assert.rejects(submission.object(['personal_data'],'  '),/REASON_INVALID/);
  await assert.rejects(submission.object(['personal_data'],'x'.repeat(1001)),/REASON_INVALID/);
  assert.equal(calls,0);
});
