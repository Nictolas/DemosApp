'use strict';

// Pure, synthetic FCM token-ownership checks. No DB network, Firebase,
// accounts, secrets or topics are accessed.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {onlyTokensNotOwnedByOthers} =
  require('../services/civicFcmTokenOwnership');

test('older account cannot revoke a token actively reassigned to another account',async()=>{
  const queries=[];
  const fakeDb={query:async(sql,params)=>{
    queries.push({sql,params});
    return {rows:[{fcm_token:'token_owned_by_new_account'}]};
  }};
  const safe=await onlyTokensNotOwnedByOthers(
    fakeDb,'old_user',['token_owned_by_new_account','token_old_user','token_old_user']);
  assert.deepEqual(safe,['token_old_user']);
  assert.equal(queries.length,1);
  assert.match(queries[0].sql,/WHERE user_id <> \$1/);
  assert.doesNotMatch(queries[0].sql,/WHERE is_active = TRUE/);
  assert.deepEqual(queries[0].params,
    ['old_user',['token_owned_by_new_account','token_old_user']]);
});

test('current owner and unassigned legacy tokens remain revocable',async()=>{
  const fakeDb={query:async()=>({rows:[]})};
  assert.deepEqual(await onlyTokensNotOwnedByOthers(
    fakeDb,'current_user',['own_token','unassigned_legacy']),
    ['own_token','unassigned_legacy']);
});

test('database owner lookup error fails closed, not assuming ownership',async()=>{
  const db={query:async()=>{throw new Error('SIMULATED_DB_UNAVAILABLE')}};
  await assert.rejects(onlyTokensNotOwnedByOthers(db,'user',['token']),/SIMULATED_DB_UNAVAILABLE/);
  await assert.rejects(onlyTokensNotOwnedByOthers({query:async()=>({})},'user',['token']),
    /CIVIC_FCM_OWNER_LOOKUP_FAILED/);
});

test('empty/invalid candidates do not invoke the DB',async()=>{
  let calls=0;
  const db={query:async()=>{calls++;return {rows:[]}}};
  assert.deepEqual(await onlyTokensNotOwnedByOthers(db,'user',[null,'',undefined]),[]);
  assert.equal(calls,0);
});

test('every FCM revocation path rejects reassigned foreign token, active or inactive',()=>{
  const route=fs.readFileSync(path.join(__dirname,'../routes/fcm-tokens.js'),'utf8');
  assert.match(route,/staleSafeLegacy = await onlyTokensNotOwnedByOthers/);
  assert.match(route,/getSupersededCivicTokens\(db,userId,tokenToKeep\)/);
  assert.match(route,/const revocable = await onlyTokensNotRegisteredToOthers\(db, userId, \[\.\.\.removed\]\)/);
  assert.match(route,/db, userId, \[\.\.\.registered\.rows\.map/);
  assert.match(route,/if \(revocable\.includes\(token\)\)/);
  assert.match(route,/if \(isCivicPushEnabled\(\) && isOwned && isValidFcmToken\(token\)\)/);
  const ownership=fs.readFileSync(path.join(__dirname,'../services/civicFcmTokenOwnership.js'),'utf8');
  assert.match(ownership,/WHERE user_id <> \$1/);
  assert.match(ownership,/user_id<>\$1 AND fcm_token=\$2/);
  // No token values printed, no topic messages created.
  assert.doesNotMatch(route,/console\.log\([^\n]*fcm_token/);
});

test('cleanup rejects tokens registered to another user including inactive devices',async()=>{
  const recorded=[];
  const db={query:async(sql,values)=>{
    recorded.push({sql,values});
    return {rows:[{fcm_token:'foreign_inactive'},{fcm_token:'foreign_active'}]};
  }};
  const eligible=await require('../services/civicFcmTokenOwnership')
    .onlyTokensNotRegisteredToOthers(db,'old_account',[
      'own_token','foreign_active','foreign_inactive','unassigned','own_token'
    ]);
  assert.deepEqual(eligible,['own_token','unassigned']);
  assert.match(recorded[0].sql,/WHERE user_id <> \$1/);
  assert.doesNotMatch(recorded[0].sql,/is_active = TRUE/);
  assert.deepEqual(recorded[0].values,['old_account',[
    'own_token','foreign_active','foreign_inactive','unassigned'
  ]]);
});

test('cleanup SQL UPSERT forbids changing a foreign owner even in a race',async()=>{
  const recorded=[];
  const db={query:async(sql,params)=>{
    recorded.push({sql,params});
    return {rowCount:1};
  }};
  await require('../services/civicFcmTokenOwnership')
    .upsertCleanupOwnedOrUnassignedToken(db,'old_user','my_token');
  assert.match(recorded[0].sql,/WHERE user_devices\.user_id = EXCLUDED\.user_id/);
  assert.doesNotMatch(recorded[0].sql,/user_id = EXCLUDED\.user_id,/);
  assert.deepEqual(recorded[0].params,['old_user','my_token']);
  await assert.rejects(require('../services/civicFcmTokenOwnership')
    .upsertCleanupOwnedOrUnassignedToken({
      query:async()=>({rowCount:0}),
    },'old_user','foreign_token'),/CIVIC_FCM_CLEANUP_OWNERSHIP_UNCONFIRMED/);
});

test('cleanup never assumes ownership when DB lookup fails',async()=>{
  const svc=require('../services/civicFcmTokenOwnership');
  await assert.rejects(svc.onlyTokensNotRegisteredToOthers({
    query:async()=>{throw Error('OFFLINE_FAKE_DB_FAILED');}
  },'old_user',['token']),/OFFLINE_FAKE_DB_FAILED/);
  await assert.rejects(svc.onlyTokensNotRegisteredToOthers({
    query:async()=>({rows:null})
  },'old_user',['token']),/CIVIC_FCM_CLEANUP_OWNER_LOOKUP_FAILED/);
});

test('canonical FCM lookup uses current account, active devices, newest first',async()=>{
  const queries=[];
  const db={query:async(sql,params)=>{
    queries.push({sql,params});
    return {rows:[{fcm_token:'newest'},{fcm_token:'older'}]};
  }};
  const {getActiveCivicUserDeviceTokens}=require('../services/civicFcmTokenOwnership');
  assert.deepEqual(await getActiveCivicUserDeviceTokens(db,'synthetic_user'),[
    'newest','older']);
  assert.equal(queries.length,1);
  assert.match(queries[0].sql,/WHERE user_id = \$1 AND is_active = TRUE/);
  assert.match(queries[0].sql,/ORDER BY updated_at DESC NULLS LAST/);
  assert.deepEqual(queries[0].params,['synthetic_user']);
});

test('canonical device lookup fails closed on missing or malformed SQL reply',async()=>{
  const {getActiveCivicUserDeviceTokens}=require('../services/civicFcmTokenOwnership');
  await assert.rejects(getActiveCivicUserDeviceTokens({
    query:async()=>({rows:null}),
  },'synthetic_user'),/CIVIC_FCM_CANONICAL_READ_UNCONFIRMED/);
  await assert.rejects(getActiveCivicUserDeviceTokens({
    query:async()=>({rows:[{fcm_token:null}]}),
  },'synthetic_user'),/CIVIC_FCM_CANONICAL_READ_UNCONFIRMED/);
  await assert.rejects(getActiveCivicUserDeviceTokens({query:async()=>({rows:[]})},''),
    /CIVIC_FCM_CANONICAL_CONTEXT_REQUIRED/);
});

test('transfer also unsubscribes a previous owner with an inactive device',async()=>{
  const {getSupersededCivicTokens}=require('../services/civicFcmTokenOwnership');
  const captured=[];
  const db={query:async(sql,params)=>{
    captured.push({sql,params});
    return {rows:[{fcm_token:'foreign_inactive'},{fcm_token:'old_own_active'}]};
  }};
  assert.deepEqual(await getSupersededCivicTokens(db,'new_user','foreign_inactive'),[
    'foreign_inactive','old_own_active']);
  assert.match(captured[0].sql,/user_id<>\$1 AND fcm_token=\$2/);
  assert.match(captured[0].sql,/user_id=\$1 AND is_active=TRUE/);
  assert.deepEqual(captured[0].params,['new_user','foreign_inactive']);
  await assert.rejects(getSupersededCivicTokens({
    query:async()=>({rows:null}),
  },'new_user','foreign_inactive'),/CIVIC_FCM_SUPERSEDED_LOOKUP_UNCONFIRMED/);
});

test('all foreign-registered tokens are protected even when inactive',async()=>{
  const {onlyTokensNotOwnedByOthers}=require('../services/civicFcmTokenOwnership');
  const sql=[];
  const db={query:async(q)=>{sql.push(q);return {rows:[{fcm_token:'inactive_foreign'}]};}};
  assert.deepEqual(await onlyTokensNotOwnedByOthers(db,'old_owner',[
    'inactive_foreign','own_token',
  ]),['own_token']);
  assert.doesNotMatch(sql[0],/is_active\s*=\s*TRUE/);
});
