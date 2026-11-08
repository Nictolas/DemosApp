'use strict';
const { test }=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../routes/notifiche.js'),'utf8');
test('no recipient/title/preference values or raw database exceptions in notification logs',()=>{
 assert.doesNotMatch(source,/console\.(?:log|error|warn)\([^\n]*(?:,\s*(?:err|error)\b|\.message\b|queryText|\$\{user_id\}|ultimaNotifica\.titolo)/);
 assert.doesNotMatch(source,/console\.error\('❌ Error details'/);
 assert.doesNotMatch(source,/console\.log\(`✅ Preferenze notifiche salvate/);
 assert.match(source,/console\.info\('NOTIF_PREFERENCES_SAVED'\)/);
 assert.match(source,/console\.error\('NOTIF_FEED_FAILED'\)/);
});
test('no debug SQL or connection metadata in notification error responses',()=>{
 assert.doesNotMatch(source,/details\s*:\s*error\.message/);
 assert.doesNotMatch(source,/database_url_present\s*:|db_host\s*:\s*process\.env\.DB_HOST/);
});
