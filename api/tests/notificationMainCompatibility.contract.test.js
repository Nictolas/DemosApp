'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');

test('notification routing retains DEMOS12 recipient restrictions and DEMOS10 read-only defaults',()=>{
 const route=read('routes/notifiche.js');
 assert.match(route,/const isAdmin = Boolean\(req\.user\?\.isAdmin\)/);
 assert.equal((route.match(/WHERE \(id_utente IS NULL OR id_utente = \$1::uuid\)/g)||[]).length,2);
 assert.match(route,/notificationSchemaCache/);
 assert.match(route,/reconcileCivicTopicsForUser/);
 assert.match(route,/withCivicPushDeliveryLock/);
 const get=route.slice(route.indexOf('// GET /api/notifiche/preferenze'),route.indexOf('// POST /api/notifiche/preferenze'));
 assert.doesNotMatch(get,/\b(?:INSERT|UPDATE|DELETE)\s+(?:INTO|notifiche_preferenze|FROM)\b/i);
 assert.match(get,/iniziative_popolari/);
 assert.match(get,/referendum_abrogativi/);
 assert.match(get,/\beci\b/);
 assert.doesNotMatch(route,/database_url_present|details: error\.message/);
});
test('civic push default is OFF without explicit feature activation',()=>{
 const { isCivicPushEnabled }=require('../services/civicPushTopics');
 assert.equal(isCivicPushEnabled({}),false);
 assert.equal(isCivicPushEnabled({CIVIC_PUSH_ENABLED:'false'}),false);
});
test('all referenced civic topic and session lock safety modules are present and parseable',()=>{
 for(const name of ['notificationSchemaCache','civicPushTopics','civicPushDeliveryGuard',
   'civicRuntimeDatabaseIdentity','civicSessionLockSafety']){
   assert.ok(read('services/'+name+'.js').length>50,name+' must not be missing');
 }
});
