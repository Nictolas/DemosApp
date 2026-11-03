'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assertCivicDatabaseIdentity } = require('../services/civicRuntimeDatabaseIdentity');

const ID = '00000000-0000-4000-8000-000000000539';
const OTHER = '00000000-0000-4000-8000-000000000540';
const db = (id=ID) => ({
  queries: [],
  async query(sql) {
    this.queries.push(sql);
    return { rows: id ? [{ db_identity:id }] : [] };
  },
});
test('matching runtime marker allows collection and sends with one read only', async () => {
  const client=db();
  assert.equal(await assertCivicDatabaseIdentity(client,{expectedId:ID}),true);
  assert.equal(client.queries.length,1);
  assert.match(client.queries[0],/SELECT db_identity::text AS db_identity FROM civic_runtime_identity/);
});

test('missing, malformed, different or missing DB marker always fails closed', async () => {
  for (const invalid of [undefined, '', 'wrong', 'postgres://password', 'a'.repeat(36)]) {
    const client=db();
    await assert.rejects(assertCivicDatabaseIdentity(client,{expectedId:invalid}),
      /CIVIC_DATABASE_IDENTITY_NOT_CONFIGURED/);
    assert.equal(client.queries.length,0);
  }
  const wrong=db(OTHER);
  await assert.rejects(assertCivicDatabaseIdentity(wrong,{expectedId:ID}),
    /CIVIC_DATABASE_IDENTITY_MISMATCH/);
  await assert.rejects(assertCivicDatabaseIdentity(db(null),{expectedId:ID}),
    /CIVIC_DATABASE_IDENTITY_MISMATCH/);
});

test('SQL failures omit provider errors and connection strings', async () => {
  const client={query:async()=>{throw Error('password=PRIVATE_TEST_SECRET')}};
  await assert.rejects(assertCivicDatabaseIdentity(client,{expectedId:ID}),
    e=>e.message==='CIVIC_DATABASE_IDENTITY_UNAVAILABLE' &&
       !e.message.includes('PRIVATE_TEST_SECRET'));
});

test('ECI checks DB identity before existing cache deletion, only with event flag', () => {
  const src=fs.readFileSync(path.resolve(__dirname,'../scripts/sync_eci.py'),'utf8');
  const start=src.indexOf('collection_enabled = os.environ.get(');
  const verify=src.indexOf('_verify_civic_database_identity(',start);
  const deleteCache=src.indexOf('cur.execute("DELETE FROM eci")',start);
  assert.ok(start>=0 && verify>start && deleteCache>verify);
  const workflow=fs.readFileSync(
    path.resolve(__dirname,'../../.github/workflows/eci_sync.yml'),'utf8');
  assert.match(workflow,/CIVIC_RUNTIME_DATABASE_ID: \$\{\{ secrets\.CIVIC_RUNTIME_DATABASE_ID \}\}/);
});

test('Ministero and dispatcher reject unverifiable DB before outbox or FCM', () => {
  const collector=fs.readFileSync(
    path.resolve(__dirname,'../services/civicNewInitiativeEventCollector.js'),'utf8');
  const dispatcher=fs.readFileSync(
    path.resolve(__dirname,'../services/civicNewInitiativePushDispatcher.js'),'utf8');
  assert.ok(collector.indexOf('await assertCivicDatabaseIdentity(pool)') <
            collector.indexOf('INSERT INTO civic_new_initiative_notifications'));
  assert.ok(dispatcher.indexOf('await assertCivicDatabaseIdentity(client)') <
            dispatcher.indexOf('const firebase = '));
});

test('token mutations and bulk FCM reconciliation also check the verified database', () => {
  const guard=fs.readFileSync(path.resolve(__dirname,'../services/civicPushDeliveryGuard.js'),'utf8');
  const bootstrap=fs.readFileSync(path.resolve(__dirname,'../services/civicPushTopicBootstrap.js'),'utf8');
  assert.match(guard,/await assertCivicDatabaseIdentity\(client\)/);
  assert.match(bootstrap,/await assertCivicDatabaseIdentity\(db\)/);
  assert.ok(bootstrap.indexOf('await assertCivicDatabaseIdentity(db)') <
    bootstrap.indexOf('const firebase = '));
});
