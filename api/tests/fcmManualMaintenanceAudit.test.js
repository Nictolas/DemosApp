'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname,'../..');
const read = file => fs.readFileSync(path.join(root,file),'utf8');

test('historical SQL FCM maintenance is aggregate-only, read-only and contains no write statements',()=>{
  for(const path of ['api/fix_fcm_tokens.sql','pulisci-token-fcm-invalidi.sql']) {
    const sql=read(path);
    const executable=sql.split('\n').filter(line=>!/^\s*--/.test(line)).join('\n');
    assert.match(executable,/BEGIN READ ONLY;/);
    assert.match(executable,/ROLLBACK;/);
    assert.match(executable,/COUNT\(/i);
    assert.doesNotMatch(executable,/\b(?:UPDATE|DELETE|INSERT|TRUNCATE|ALTER|DROP|CREATE|MERGE|EXECUTE|DO|COPY)\b/i);
    assert.doesNotMatch(executable,/\b(?:email|nome|cognome|fcm_tokens)\b/i);
    assert.doesNotMatch(executable,/SELECT\s+(?:\*|.*fcm_token\s+AS)/i);
  }
});

test('retired root-level scripts never contact PostgreSQL or reveal identities/tokens',()=>{
  for(const file of ['verifica-fcm-tokens.cjs','verifica-push-notifiche.cjs','verifica-utenti-demos-fcm.cjs']){
    const src=read(file);
    assert.match(src,/process\.exitCode = 2/);
    assert.doesNotMatch(src,/(?:require\(['"](?:pg|dotenv)|DATABASE_URL|(?:new\s+Pool|connect\(|\.query\(|firebaseAdmin|fcm_tokens|console\.log\(.*user)/i);
  }
});

test('historical server sender is not configured as active Render API entrypoint',()=>{
  const render=read('render.yaml');
  assert.match(render,/rootDir: api/);
  assert.match(render,/startCommand: node index\.js/);
  for(const file of ['api/index.js','api/server.js']){
    const source=read(file);
    assert.doesNotMatch(source,/(?:server\/notifica\.service|server\/comunicazione\.service)/);
  }
  // This only checks the configured entrypoints, not any external workers,
  // manual deployments or connections outside the repository.
});
