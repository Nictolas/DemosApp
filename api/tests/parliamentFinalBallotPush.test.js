'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const {sendFinalBallotPush,resolvePushTarget,MAX_RECIPIENTS}
  =require('../services/parliamentFinalBallotPushService');

test('all representative ballot push delivery stays OFF unless separately approved', async()=>{
  const previous=process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
  delete process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
  try {
    const result=await sendFinalBallotPush({
      query:()=>{throw Error('NO DATABASE READ ALLOWED');}
    },{representativeId:'id',chamber:'Camera',openpolisId:'vs19_730_097',title:'X',status:'Favorevole'});
    assert.equal(result.enabled,false);
    assert.equal(result.sent,0);
  } finally {
    if(previous===undefined)delete process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
    else process.env.PARLIAMENT_FINAL_PUSH_ENABLED=previous;
  }
});

test('uses explicit current opt-in for each chamber and only active registered devices',async()=>{
  const previous=process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
  process.env.PARLIAMENT_FINAL_PUSH_ENABLED='true';
  const calls=[],sent=[];
  const pool={ query:async(sql,args)=>{
    calls.push({sql,args});
    return {rows:[{fcm_token:'t'.repeat(120)}]};
  }};
  const admin={messaging:()=>({sendEach:async messages=>{
    sent.push(...messages);
    return {successCount:messages.length,failureCount:0};
  }})};
  try{
    assert.deepEqual(resolvePushTarget('Camera'),{selection:'rappresentante_camera',preference:'deputato'});
    assert.deepEqual(resolvePushTarget('Senato'),{selection:'rappresentante_senato',preference:'senatore'});
    assert.equal(resolvePushTarget('Parlamento europeo'),null);
    const outcome=await sendFinalBallotPush(pool,{
      representativeId:'rep-1',chamber:'Camera',openpolisId:'vs19_730_097',
      title:'Voto finale',status:'Favorevole'
    },{firebaseAdmin:admin});
    assert.equal(outcome.sent,1);
    assert.match(calls[0].sql,/u\.rappresentante_camera = \$1::text/);
    assert.match(calls[0].sql,/p\.deputato IS TRUE/);
    assert.match(calls[0].sql,/d\.is_active = TRUE/);
    assert.match(calls[0].sql,/lower\(coalesce\(u\.status/);
    assert.equal(calls[0].args[1],MAX_RECIPIENTS+1);
    assert.equal(sent[0].data.type,'parliament_final_vote');
    assert.equal(sent[0].data.url,'/notifiche?final_vote=vs19_730_097');
    assert.equal(sent[0].android.notification.channelId,'demos_notifications');
    await sendFinalBallotPush(pool,{
      representativeId:'rep-1',chamber:'Senato',openpolisId:'19-469-3',
      title:'Voto finale',status:'Astenuto R'
    },{firebaseAdmin:admin});
    assert.match(calls[1].sql,/u\.rappresentante_senato = \$1::text/);
    assert.match(calls[1].sql,/p\.senatore IS TRUE/);
    assert.equal(sent[1].data.url,'/notifiche?final_vote=19-469-3');
  }finally{
    if(previous===undefined)delete process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
    else process.env.PARLIAMENT_FINAL_PUSH_ENABLED=previous;
  }
});

test('capacity gate prevents partial broadcasts and invalid parliamentary IDs fail closed',async()=>{
  const previous=process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
  process.env.PARLIAMENT_FINAL_PUSH_ENABLED='true';
  let attempted=0;
  const admin={messaging:()=>({sendEach:async()=>{attempted++;return {successCount:1,failureCount:0};}})};
  try{
    await assert.rejects(sendFinalBallotPush({query:async()=>({rows:[]})},{
      representativeId:'1',chamber:'Regione',openpolisId:'vs19_730_097'
    },{firebaseAdmin:admin}),/PARLIAMENT_PUSH_INVALID_TARGET/);
    const result=await sendFinalBallotPush({
      query:async()=>({rows:Array.from({length:MAX_RECIPIENTS+1},()=>({fcm_token:'t'.repeat(120)}))})
    },{representativeId:'1',chamber:'Senato',openpolisId:'19-469-3'},{
      firebaseAdmin:admin
    });
    assert.equal(result.capacityGate,true);
    assert.equal(attempted,0);
  } finally {
    if(previous===undefined)delete process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
    else process.env.PARLIAMENT_FINAL_PUSH_ENABLED=previous;
  }
});
