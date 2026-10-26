'use strict';

const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const root=path.resolve(__dirname,'..');
const load=relative=>fs.readFileSync(path.join(root,relative),'utf8');

test('Firebase invalid-token cleanup in every active writer delegates to shared transaction',()=>{
  const communication=load('routes/comunicazioni.js');
  const sightings=load('routes/avvistamenti.js');
  const operations=load('services/operationalAlertService.js');
  for(const [name,source] of [
    ['comunicazioni',communication],['avvistamenti',sightings],['operational',operations]
  ]){
    assert.match(source,/invalidateFailedFcmTokens/,
      name+' must use the account-locked invalidation helper');
    assert.doesNotMatch(source,/UPDATE\s+(?:public\.)?user_devices\s+SET\s+is_active/i,
      name+' must not directly deactivate FCM tokens outside a transaction');
    assert.doesNotMatch(source,/UPDATE\s+(?:public\.)?users\s+SET\s+fcm_tokens/i,
      name+' must not directly mutate legacy tokens outside a transaction');
    assert.doesNotMatch(source,/DELETE\s+FROM\s+(?:public\.)?user_devices/i,
      name+' must not delete canonical tombstones');
  }
  assert.match(communication,/invalidateUserFcmTokens\(userId, invalidTokens\)/);
  assert.match(sightings,/userId: targetUser\.id, tokens: \[fcmToken\]/);
  assert.match(operations,/invalidateToken\(device\.user_id, device\.fcm_token\)/);
  assert.doesNotMatch(operations,/invalidateToken\(device\.fcm_token\)/);
});

test('shared FCM invalidator follows canonical account lock and record-retaining rules',()=>{
  const invalidator=load('services/fcmTokenInvalidationService.js');
  const registration=load('routes/fcm-tokens.js');
  for(const source of [invalidator,registration]){
    assert.match(source,/SELECT id FROM public\.users WHERE id = \$1 FOR UPDATE/);
    assert.match(source,/await client\.query\('BEGIN'\)/);
    assert.match(source,/await client\.query\('COMMIT'\)/);
    assert.match(source,/await client\.query\('ROLLBACK'\)/);
    assert.match(source,/client\.release\(\)/);
  }
  assert.match(invalidator,/UPDATE public\.user_devices/);
  assert.match(invalidator,/WHERE user_id = \$1 AND is_active = TRUE/);
  assert.match(invalidator,/btrim\(fcm_token\) = ANY\(\$2::text\[\]\)/);
  assert.match(invalidator,/ROLLBACK TO SAVEPOINT fcm_invalid_legacy/);
  assert.doesNotMatch(invalidator,/DELETE FROM (?:public\.)?user_devices/);
});
