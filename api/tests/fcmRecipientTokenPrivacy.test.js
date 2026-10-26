'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {
  RECIPIENT_FCM_TOKENS_LATERAL_SQL,
  loadRecipientFcmTokensForUser,
  isRecipientFcmTokenCurrentlyActive
}=require('../services/fcmRecipientTokenService');

const USER='00000000-0000-4000-8000-000000000611';
const TOKEN='s'.repeat(125);
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('recipient SQL is schema-pinned and a canonical inactive/transferred token overrides legacy',()=>{
  const sql=RECIPIENT_FCM_TOKENS_LATERAL_SQL;
  assert.match(sql,/FROM public\.user_devices d/);
  assert.match(sql,/FROM public\.user_devices registered/g);
  assert.match(sql,/d\.user_id = u\.id/);
  assert.match(sql,/d\.is_active = TRUE/);
  assert.match(sql,/btrim\(legacy\.token\)/);
  assert.match(sql,/registered\.fcm_token = btrim\(legacy\.token\)/);
  assert.match(sql,/btrim\(registered\.fcm_token\) = btrim\(legacy\.token\)/);
  assert.match(sql,/WHEN EXISTS[\s\S]*THEN FALSE[\s\S]*ELSE NOT EXISTS/);
  assert.doesNotMatch(sql,/\bFROM user_devices\b/);
  assert.doesNotMatch(sql,/\bFROM users\b/);
});

test('a single consistent token resolver drives all six Demos broadcasts and sightings',()=>{
  const communication=read('routes/comunicazioni.js');
  const sightings=read('routes/avvistamenti.js');
  assert.equal((communication.match(/\$\{RECIPIENT_FCM_TOKENS_LATERAL_SQL\}/g)||[]).length,6);
  assert.equal((sightings.match(/\$\{RECIPIENT_FCM_TOKENS_LATERAL_SQL\}/g)||[]).length,1);
  assert.match(communication,/loadRecipientFcmTokensForUser\(pool, userId\)/);
  assert.match(communication,/isRecipientFcmTokenCurrentlyActive\(pool, \{ userId, token \}\)/);
  assert.match(communication,/isRecipientFcmTokenCurrentlyActive\(pool, \{\s*userId: utente\.id, token/);
  assert.match(sightings,/isRecipientFcmTokenCurrentlyActive\(pool, \{\s*userId: targetUser\.id, token: fcmToken/);
  assert.doesNotMatch(communication,/SELECT unnest\(COALESCE\(u\.fcm_tokens/);
  assert.doesNotMatch(sightings,/SELECT unnest\(COALESCE\(u\.fcm_tokens/);
  assert.doesNotMatch(communication,/console\.error\(.*error\.stack/);
  assert.doesNotMatch(sightings,/Errore invio push notification.*error\.message/);
});

test('single-recipient lookup binds a UUID and does not leak another account token',async()=>{
  const statements=[];
  const db={async query(sql,params) {
    statements.push({sql:String(sql),params});
    return {rows:[{fcm_tokens:[TOKEN]}]};
  }};
  assert.deepEqual(await loadRecipientFcmTokensForUser(db,USER),[TOKEN]);
  assert.equal(statements.length,1);
  assert.deepEqual(statements[0].params,[USER]);
  assert.match(statements[0].sql,/FROM public\.users u/);
  assert.match(statements[0].sql,/u\.id = \$1::uuid/);
  assert.match(statements[0].sql,/NOT EXISTS/);
});

test('fresh pre-send read is bound to account and token; empty and DB failures do not authorize',async()=>{
  const captured=[];
  const db={async query(sql,params) {
    captured.push({sql:String(sql),params});
    return {rows:[{eligible:false}]};
  }};
  assert.equal(await isRecipientFcmTokenCurrentlyActive(db,{userId:USER,token:' '+TOKEN+' '}),false);
  assert.deepEqual(captured[0].params,[USER,TOKEN]);
  assert.match(captured[0].sql,/SELECT EXISTS/);
  assert.match(captured[0].sql,/\$2::text = ANY\(COALESCE\(tokens\.tokens, ARRAY\[\]::text\[\]\)\)/);
  assert.equal(await isRecipientFcmTokenCurrentlyActive(db,{userId:USER,token:'  '}),false);
  assert.equal(await isRecipientFcmTokenCurrentlyActive(db,{userId:USER,token:null}),false);
  assert.equal(captured.length,1);
  const offline={query:async()=>{throw Object.assign(Error('offline'),{code:'08006'});}};
  await assert.rejects(isRecipientFcmTokenCurrentlyActive(offline,{userId:USER,token:TOKEN}),
    error=>error.code==='08006');
});

test('a successful current check is conditional on the canonical SQL result',async()=>{
  let queries=0;
  const db={async query(sql,params){
    queries++;
    assert.equal(params[1],TOKEN);
    return {rows:[{eligible:true}]};
  }};
  assert.equal(await isRecipientFcmTokenCurrentlyActive(db,{userId:USER,token:TOKEN}),true);
  assert.equal(queries,1);
});
