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
  assert.match(queries[0].sql,/is_active = TRUE AND user_id <> \$1/);
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

test('every FCM revocation path rejects reassigned foreign active token',()=>{
  const route=fs.readFileSync(path.join(__dirname,'../routes/fcm-tokens.js'),'utf8');
  assert.match(route,/staleSafeLegacy = await onlyTokensNotOwnedByOthers/);
  assert.match(route,/const revocable = await onlyTokensNotOwnedByOthers\(db, userId, \[\.\.\.removed\]\)/);
  assert.match(route,/db, userId, \[\.\.\.registered\.rows\.map/);
  assert.match(route,/if \(revocable\.includes\(token\)\)/);
  assert.match(route,/if \(isCivicPushEnabled\(\) && isOwned && isValidFcmToken\(token\)\)/);
  assert.match(route,/user_id <> \$1/);
  // No token values printed, no topic messages created.
  assert.doesNotMatch(route,/console\.log\([^\n]*fcm_token/);
});
