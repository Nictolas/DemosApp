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
  const token='t'.repeat(120);
  const pool={
    query:async(sql,args)=>{
      calls.push({sql,args});
      return {rows:[{fcm_token:token}]};
    },
    connect:async()=>({
      query:async(sql,args)=>{
        calls.push({sql,args});
        return sql.includes('FOR SHARE OF u, ps, p, d') ? {rows:[{fcm_token:token}]} : {rows:[]};
      },
      release:()=>calls.push({sql:'RELEASE'})
    })
  };
  const admin={messaging:()=>({sendEach:async messages=>{
    sent.push(...messages);
    return {successCount:messages.length,failureCount:0};
  }})};
  try{
    assert.deepEqual(resolvePushTarget('Camera'),{office:'it.camera',preference:'deputato'});
    assert.deepEqual(resolvePushTarget('Senato'),{office:'it.senato',preference:'senatore'});
    assert.equal(resolvePushTarget('Parlamento europeo'),null);
    const outcome=await sendFinalBallotPush(pool,{
      representativeId:'rep-1',chamber:'Camera',openpolisId:'vs19_730_097',
      title:'DDL sensibile e tema non pubblicabile nel push',status:'Favorevole'
    },{firebaseAdmin:admin});
    assert.equal(outcome.sent,1);
    assert.match(calls[0].sql,/ps\.selected_user_id = \$1::uuid/);
    assert.match(calls[0].sql,/p\.deputato IS TRUE/);
    assert.match(calls[0].sql,/d\.is_active = TRUE/);
    assert.match(calls[0].sql,/lower\(coalesce\(u\.status/);
    assert.equal(calls[0].args[1],'it.camera');
    assert.equal(calls[0].args[2],MAX_RECIPIENTS+1);
    assert.equal(sent[0].data.type,'parliament_final_vote');
    assert.equal(sent[0].data.url,'/notifiche?final_vote=vs19_730_097');
    assert.equal(sent[0].notification.body,
      'Una nuova votazione finale è disponibile. Apri DEMOS per i dettagli.');
    assert.ok(!sent[0].notification.body.includes('Favorevole'));
    assert.ok(!sent[0].notification.body.includes('DDL sensibile'));
    assert.equal(sent[0].notification.title,'Il tuo deputato: nuova votazione finale');
    assert.equal(sent[0].android.notification.channelId,'demos_notifications');
    assert.ok(calls.some(x=>x.sql.includes('FOR SHARE OF u, ps, p, d')));
    assert.ok(calls.some(x=>x.sql === 'COMMIT'));
    assert.ok(calls.some(x=>x.sql === 'RELEASE'));
    await sendFinalBallotPush(pool,{
      representativeId:'rep-1',chamber:'Senato',openpolisId:'19-469-3',
      title:'Voto finale',status:'Astenuto R'
    },{firebaseAdmin:admin});
    assert.match(calls.find(x=>x.sql.includes('p.senatore IS TRUE')).sql,/ps\.political_office_id = \$2/);
    assert.ok(calls.some(x=>x.sql.includes('p.senatore IS TRUE')));
    assert.equal(calls.find(x=>x.sql.includes('p.senatore IS TRUE')).args[1],'it.senato');
    assert.equal(sent[1].data.url,'/notifiche?final_vote=19-469-3');
    assert.equal(sent[1].notification.body,
      'Una nuova votazione finale è disponibile. Apri DEMOS per i dettagli.');
    assert.ok(!sent[1].notification.body.includes('Astenuto'));
    assert.equal(sent[1].notification.title,'Il tuo senatore: nuova votazione finale');
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

test('a revoked preference between candidate discovery and locked batch suppresses push',async()=>{
  const prior=process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
  process.env.PARLIAMENT_FINAL_PUSH_ENABLED='true';
  let sent=0, transactions=0, released=0;
  const token='z'.repeat(120);
  const pool={
    query:async()=>({rows:[{fcm_token:token}]}),
    connect:async()=>({
      query:async sql=>{
        if(sql==='BEGIN') transactions++;
        if(sql.includes('FOR SHARE OF u, ps, p, d'))return {rows:[]};
        return {rows:[]};
      },
      release:()=>{released++}
    })
  };
  try{
    const result=await sendFinalBallotPush(pool,{
      representativeId:'00000000-0000-4000-8000-000000000001',
      chamber:'Camera',openpolisId:'vs19_730_097',title:'Finale'
    },{firebaseAdmin:{messaging:()=>({sendEach:async()=>{sent++;return {successCount:1,failureCount:0}}})}});
    assert.equal(result.sent,0);
    assert.equal(sent,0);
    assert.equal(transactions,1);
    assert.equal(released,1);
  }finally{
    if(prior===undefined)delete process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
    else process.env.PARLIAMENT_FINAL_PUSH_ENABLED=prior;
  }
});

test('database lock failure prevents any FCM send and rolls back',async()=>{
  const prior=process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
  process.env.PARLIAMENT_FINAL_PUSH_ENABLED='true';
  const statements=[];
  let sends=0;
  try{
    await assert.rejects(sendFinalBallotPush({
      query:async()=>({rows:[{fcm_token:'y'.repeat(120)}]}),
      connect:async()=>({
        query:async sql=>{
          statements.push(sql);
          if(sql.includes('FOR SHARE OF u, ps, p, d'))throw Error('LOCK_FAILED');
          return {rows:[]};
        },
        release:()=>statements.push('RELEASE')
      })
    },{representativeId:'00000000-0000-4000-8000-000000000001',
      chamber:'Senato',openpolisId:'19-469-3'},
    {firebaseAdmin:{messaging:()=>({sendEach:async()=>{sends++}})}}),/LOCK_FAILED/);
    assert.equal(sends,0);
    assert.ok(statements.includes('ROLLBACK'));
    assert.ok(statements.includes('RELEASE'));
  }finally{
    if(prior===undefined)delete process.env.PARLIAMENT_FINAL_PUSH_ENABLED;
    else process.env.PARLIAMENT_FINAL_PUSH_ENABLED=prior;
  }
});
