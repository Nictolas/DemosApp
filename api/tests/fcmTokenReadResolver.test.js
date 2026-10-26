'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {RESOLVED_FCM_TOKENS_LATERAL_SQL,getResolvedUserFcmTokens,isUserFcmTokenEligible}=require('../services/fcmTokenReadResolver');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('canonical inactive/transferred rows block old legacy copies',()=>{
  assert.match(RESOLVED_FCM_TOKENS_LATERAL_SQL,/d\.is_active IS TRUE/);
  assert.match(RESOLVED_FCM_TOKENS_LATERAL_SQL,/registered\.fcm_token = btrim\(legacy\.token\)/);
  assert.match(RESOLVED_FCM_TOKENS_LATERAL_SQL,/btrim\(registered\.fcm_token\) = btrim\(legacy\.token\)/);
  assert.doesNotMatch(RESOLVED_FCM_TOKENS_LATERAL_SQL,/registered\.is_active\s*=\s*TRUE/);
  assert.doesNotMatch(RESOLVED_FCM_TOKENS_LATERAL_SQL,/registered\.user_id\s*=\s*u\.id/);
});
test('all communication and sightings sending reads share resolver and pre-send check',()=>{
  const comm=read('routes/comunicazioni.js'), sightings=read('routes/avvistamenti.js');
  for(const source of [comm,sightings]){
    assert.match(source,/RESOLVED_FCM_TOKENS_LATERAL_SQL/);
    assert.match(source,/isUserFcmTokenEligible/);
    assert.doesNotMatch(source,/SELECT unnest\(COALESCE\(u\.fcm_tokens/);
    assert.doesNotMatch(source,/SELECT DISTINCT tok/);
  }
  assert.match(comm,/return getResolvedUserFcmTokens\(pool, userId\)/);
  assert.match(sightings,/if \(!eligible\) continue;/);
});
test('read errors propagate instead of invalidating tokens',async()=>{
  const id='00000000-0000-4000-8000-000000000611';
  const pool={query:async()=>{throw Object.assign(Error('synthetic read failure'),{code:'57014'});}};
  await assert.rejects(isUserFcmTokenEligible(pool,{userId:id,token:'abc'}),e=>e?.code==='57014');
  await assert.rejects(getResolvedUserFcmTokens(pool,id),e=>e?.code==='57014');
});
test('missing input does not query',async()=>{
  const pool={query:()=>{throw Error('unexpected query');}};
  assert.equal(await isUserFcmTokenEligible(pool,{userId:'mock',token:'  '}),false);
  assert.deepEqual(await getResolvedUserFcmTokens(pool,null),[]);
});

test('blocked accounts cannot return tokens or pass the pre-send check',async()=>{
  const {BLOCKED_FCM_USER_STATUSES}=require('../services/fcmTokenReadResolver');
  const queries=[],id='00000000-0000-4000-8000-000000000611';
  const pool={query:async(sql,params)=>{queries.push({sql,params});return {rows:[{eligible:false,fcm_tokens:[]}]};}};
  await getResolvedUserFcmTokens(pool,id);
  await isUserFcmTokenEligible(pool,{userId:id,token:'abc'});
  assert.ok(BLOCKED_FCM_USER_STATUSES.includes('deleted'));
  assert.ok(queries.every(q=>q.sql.includes('u.status')));
  assert.ok(queries.every(q=>q.params.includes(BLOCKED_FCM_USER_STATUSES)));
});
test('supported notification preferences recheck current status and unknown values fail closed',async()=>{
  const queries=[],id='00000000-0000-4000-8000-000000000611';
  const pool={query:async(sql)=>{queries.push(sql);return {rows:[{eligible:true}]};}};
  assert.equal(await isUserFcmTokenEligible(pool,{userId:id,token:'abc',preference:'animali'}),true);
  assert.match(queries[0],/np\.animali IS FALSE/);
  assert.equal(await isUserFcmTokenEligible(pool,{userId:id,token:'abc',preference:'demos'}),true);
  assert.match(queries[1],/np\.demos IS TRUE/);
  assert.equal(await isUserFcmTokenEligible(pool,{userId:id,token:'abc',preference:'bad;DROP'}),false);
  assert.equal(queries.length,2);
});
test('both notification channels pass a preference and sightings filter disabled accounts',()=>{
  const comm=read('routes/comunicazioni.js'),av=read('routes/avvistamenti.js');
  assert.match(comm,/userId: utente\.id, token, preference: 'demos'/);
  assert.match(av,/userId: targetUser\.id, token: fcmToken, preference: 'animali'/);
  assert.match(av,/BLOCKED_FCM_USER_STATUSES/);
});
