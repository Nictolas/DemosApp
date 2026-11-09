'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../services/privacyErasureLedgerService.js'),'utf8');
test('retains DEMOS10 civic push delivery barrier during account deletion',()=>{
 assert.match(source,/lockCivicPushDuringAccountErasure\(client\)/);
 assert.match(source,/unsubscribeCivicTopicsForToken\(fcm_token\)/);
 assert.match(source,/blockCivicDeliveryOnRevocationFailure\(client\)/);
 const a=source.indexOf('lockCivicPushDuringAccountErasure(client)');
 const b=source.indexOf('const additional = await this.cleanupAdditionalAccountData(client, userId)');
 assert.ok(a>=0&&b>a);
});
test('retains DEMOS12 proposal DSAR and account row lock in same deletion transaction',()=>{
 assert.match(source,/DELETE FROM subject_proposals WHERE proposer_user_id::text=\$1 AND status IN \('pending','rejected'\)/);
 assert.match(source,/SELECT confdeltype FROM pg_constraint/);
 assert.match(source,/GRAZIA_ERASURE_MIGRATION_REQUIRED/);
 assert.match(source,/UPDATE richieste_grazia SET utente_id=NULL WHERE utente_id::text=\$1/);
 const a=source.indexOf('SELECT id FROM users WHERE id::text=$1 FOR UPDATE');
 const b=source.indexOf('const additional = await this.cleanupAdditionalAccountData(client, userId)');
 assert.ok(a>=0&&b>a);
 assert.doesNotMatch(source,/DELETE FROM subject_proposals WHERE proposer_user_id::text=\$1(?! AND status)/);
});
