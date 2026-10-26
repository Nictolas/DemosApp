'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const express = require('express');
const http = require('node:http');
const crypto = require('node:crypto');
const { privacyRecoveryMaintenance } = require('../middleware/privacyRecoveryMaintenance');
const Ledger = require('../services/privacyErasureLedgerService');
const { PrivacyErasureOutboxWorker } = require('../services/privacyErasureOutboxWorker');
const { verifyOutboxRecoveryReadiness } = require('../services/privacyOutboxRecoveryReadiness');
const { normalizeEvent: normalizeB2Event } = require('../services/privacyErasureB2Journal');
const {
  signature, manifestDigest, assertIndependentRecoveryCheckpoint, verifySignedManifest, reconcileRestoredPrivacyState
} = require('../services/privacyRecoveryGateService');

const SECRET = 'synthetic-test-only-hmac-key-at-least-32-bytes';
const KEY = '00000000-0000-4000-8000-000000000301';
const ID = 'recovery_ci_20261026';
const mkEvent = (type = 'political_consent_revoked', extras = {}) => ({
  event_key: crypto.randomUUID(), subject_user_id: KEY, event_type: type,
  occurred_at: '2026-10-26T00:00:00.000Z', details: { action: 'test', z: 1 },
  ...extras
});
function signed(payload) { return { payload, signature: signature(payload, SECRET) }; }
function fixture(events = [mkEvent()]) {
  return signed({
    formatVersion: 1, recoveryId: ID, capturedAt: '2026-10-26T01:00:00.000Z',
    restoredBackupTakenAt: '2026-10-24T00:00:00.000Z',
    events
  });
}
test('outbox worker fails closed during recovery maintenance before SQL and B2', async () => {
  const env = {
    GDPR_ERASURE_OUTBOX_ENABLED:'true',
    GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'true'
  };
  let connections = 0, b2 = 0;
  const pool = {async connect() {
    connections++;
    throw Error('Unexpected PostgreSQL connection');
  }};
  const exporter = {
    config() { b2++; return {}; },
    async archiveEvent() { b2++; throw Error('Unexpected B2 archive'); }
  };
  const worker = new PrivacyErasureOutboxWorker({env,exporter});
  for (const mode of ['true', 'TRUE', 'false ', 'true ', '', '0']) {
    env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = mode;
    await assert.rejects(worker.runOnce(pool),/blocked during recovery maintenance/,
      'recovery flag '+JSON.stringify(mode));
    assert.equal(connections,0,'no SQL connection during recovery');
    assert.equal(b2,0,'no B2 calls during recovery');
  }
  // A normal, explicit false setting must not trip the maintenance gate.
  env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = 'false';
  assert.doesNotThrow(()=>worker.validate());
  delete env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE;
  assert.doesNotThrow(()=>worker.validate());
  assert.equal(b2,2,'config is allowed only when maintenance is not active');
});

test('outbox worker rolls back when recovery starts during B2 delivery', async () => {
  const env = {
    GDPR_ERASURE_OUTBOX_ENABLED:'true',
    GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'true',
    DEMOS_PRIVACY_RECOVERY_MAINTENANCE:'false'
  };
  const log=[];
  const event=mkEvent();
  const client = {
    async query(sql) {
      log.push(sql);
      if(sql==='BEGIN' || sql==='ROLLBACK' ||
         sql==='SET LOCAL search_path = pg_catalog, public, pg_temp') return {rows:[]};
      if(sql.includes('FOR UPDATE OF o SKIP LOCKED')) return {rows:[event]};
      throw Error('Unexpected SQL after recovery flag was enabled');
    },
    release(){log.push('RELEASE');}
  };
  const pool={async connect(){log.push('CONNECT');return client;}};
  let uploads=0;
  const worker=new PrivacyErasureOutboxWorker({env,exporter:{
    config(){return {};},
    async archiveEvent(row){
      uploads++;
      assert.equal(row.event_key,event.event_key);
      env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE='true';
      return {eventKey:event.event_key,versionId:'synthetic-b2-version',sha256:'a'.repeat(64)};
    }
  }});
  await assert.rejects(worker.runOnce(pool,{limit:1}),/blocked during recovery maintenance/);
  assert.equal(uploads,1,'one B2 operation was already in flight');
  const schemaPin=log.indexOf('SET LOCAL search_path = pg_catalog, public, pg_temp');
  const select=log.findIndex(sql=>sql.includes('FOR UPDATE OF o SKIP LOCKED'));
  assert.ok(log.indexOf('BEGIN')<schemaPin && schemaPin<select,
    'pin public schema before reading pending outbox rows and sending B2');
  assert.ok(log.includes('ROLLBACK'));
  assert.ok(log.includes('RELEASE'));
  assert.equal(log.some(sql=>sql.includes('UPDATE privacy_erasure_delivery_outbox')),false,
    'delivery marker must remain pending after the switch');
  assert.equal(log.includes('COMMIT'),false);
});

test('outbox worker rolls back when recovery starts after SQL delivery update', async () => {
  const env = {
    GDPR_ERASURE_OUTBOX_ENABLED:'true',
    GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'true',
    DEMOS_PRIVACY_RECOVERY_MAINTENANCE:'false'
  };
  const log=[];
  const event=mkEvent();
  const client={
    async query(sql) {
      log.push(sql);
      if(sql==='BEGIN'||sql==='ROLLBACK' ||
         sql==='SET LOCAL search_path = pg_catalog, public, pg_temp') return {rows:[]};
      if(sql.includes('FOR UPDATE OF o SKIP LOCKED')) return {rows:[event]};
      if(sql.includes('UPDATE privacy_erasure_delivery_outbox')) {
        env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE='true';
        return {rowCount:1,rows:[{event_key:event.event_key}]};
      }
      throw Error('Unexpected SQL');
    },
    release(){log.push('RELEASE');}
  };
  const worker=new PrivacyErasureOutboxWorker({env,exporter:{
    config(){return {};},
    async archiveEvent(){
      return {eventKey:event.event_key,versionId:'synthetic-b2-version',sha256:'a'.repeat(64)};
    }
  }});
  await assert.rejects(worker.runOnce({
    async connect(){return client;}
  },{limit:1}),/blocked during recovery maintenance/);
  assert.ok(log.some(sql=>sql.includes('UPDATE privacy_erasure_delivery_outbox')));
  assert.ok(log.includes('ROLLBACK'),'SQL update must be rolled back');
  assert.equal(log.includes('COMMIT'),false,'no commit after maintenance was engaged');
  assert.ok(log.includes('RELEASE'));
});

test('ordinary outbox worker aborts before B2 when schema pin fails', async () => {
  const statements=[];
  let b2Calls=0, released=false;
  const worker=new PrivacyErasureOutboxWorker({
    env:{GDPR_ERASURE_OUTBOX_ENABLED:'true',GDPR_ERASURE_OUTBOX_WORKER_ENABLED:'true'},
    exporter:{
      config(){return {};},
      async archiveEvent(){b2Calls++;throw Error('unexpected B2');}
    }
  });
  const client={
    async query(sql){
      statements.push(sql);
      if(sql==='BEGIN' || sql==='ROLLBACK') return {rows:[]};
      if(sql==='SET LOCAL search_path = pg_catalog, public, pg_temp')
        throw Error('synthetic-schema-pin-rejected');
      throw Error('unexpected SQL');
    },
    release(){released=true;}
  };
  await assert.rejects(worker.runOnce({async connect(){return client;}}),
    /synthetic-schema-pin-rejected/);
  assert.deepEqual(statements,[
    'BEGIN','SET LOCAL search_path = pg_catalog, public, pg_temp','ROLLBACK'
  ]);
  assert.equal(b2Calls,0,'never send a remote event when schema is uncertain');
  assert.equal(released,true);
});

test('malformed GDPR outbox flag refuses event writes and recovery before any SQL', async () => {
  const previous = process.env.GDPR_ERASURE_OUTBOX_ENABLED;
  let queries = 0;
  const db = { async query() {
    queries++;
    throw Error('SQL must not run for malformed outbox mode');
  }};
  const envelope = fixture();
  const checkpoint = {
    expectedManifestDigest: manifestDigest(envelope),
    expectedRestoredBackupTakenAt: envelope.payload.restoredBackupTakenAt,
    expectedCapturedAt: envelope.payload.capturedAt
  };
  try {
    for (const malformed of ['', 'TRUE', 'true ', 'FALSE', 'false ', '0']) {
      process.env.GDPR_ERASURE_OUTBOX_ENABLED = malformed;
      assert.throws(() => Ledger.outboxEnabled(), /Invalid GDPR erasure outbox mode/);
      await assert.rejects(Ledger.recordEvent(db, {
        userId: KEY, eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED
      }), /Invalid GDPR erasure outbox mode/);
      await assert.rejects(reconcileRestoredPrivacyState({
        client: db, envelope, secret: SECRET, expectedRecoveryId: ID,
        maintenanceConfirmed: true, ...checkpoint
      }), /Invalid GDPR erasure outbox mode/);
      assert.equal(queries, 0, 'no database access on invalid GDPR outbox flag');
    }
    process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'false';
    assert.equal(Ledger.outboxEnabled(), false);
    process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'true';
    assert.equal(Ledger.outboxEnabled(), true);
    delete process.env.GDPR_ERASURE_OUTBOX_ENABLED;
    assert.equal(Ledger.outboxEnabled(), false);
  } finally {
    if (previous === undefined) delete process.env.GDPR_ERASURE_OUTBOX_ENABLED;
    else process.env.GDPR_ERASURE_OUTBOX_ENABLED = previous;
  }
});

test('outbox preflight rejects events B2 cannot archive before any PostgreSQL I/O', async () => {
  const old = process.env.GDPR_ERASURE_OUTBOX_ENABLED;
  process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'true';
  const statements = [];
  const db = {async query(sql) {
    statements.push(sql);
    return {rows:[{event_key:'synthetic-test-event'}]};
  }};
  const eventType = Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED;
  try {
    for (const rejected of [
      {userId:KEY, details:{synthetic:'x'.repeat(9000)}},
      {userId:KEY, details:['array-is-not-an-object']},
      {userId:'u'.repeat(129), details:{source:'synthetic'}}
    ]) {
      await assert.rejects(Ledger.recordEvent(db, {
        ...rejected, eventType
      }), /minimization limit|Invalid GDPR ledger details|Invalid GDPR ledger event/);
      assert.equal(statements.length,0,
        'invalid GDPR event must not write ledger or delivery outbox');
    }
    const valid = await Ledger.recordEvent(db, {
      userId:KEY, eventType, details:{synthetic:'x'.repeat(7900)}
    });
    assert.equal(valid.event_key,'synthetic-test-event');
    assert.equal(statements.length,1);
    assert.match(statements[0],/INSERT INTO privacy_erasure_ledger/);
    assert.match(statements[0],/INSERT INTO privacy_erasure_delivery_outbox/);
  } finally {
    if (old === undefined) delete process.env.GDPR_ERASURE_OUTBOX_ENABLED;
    else process.env.GDPR_ERASURE_OUTBOX_ENABLED = old;
  }
});

test('GDPR outbox preflight checks exact SQL JSON despite inherited and stateful toJSON', async () => {
  const previous = process.env.GDPR_ERASURE_OUTBOX_ENABLED;
  process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'true';
  const queries = [];
  const db = {async query(sql, params) {
    queries.push({sql, params});
    return {rows:[{event_key:'synthetic-test-event'}]};
  }};
  const eventType = Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED;
  try {
    // The original JS object looks tiny when enumerated, but its inherited
    // toJSON serializes a >8 KB payload into the PostgreSQL parameter.
    const inherited = Object.create({
      toJSON() { return {synthetic:'x'.repeat(9000)}; }
    });
    inherited.harmless = true;
    await assert.rejects(Ledger.recordEvent(db, {
      userId:KEY, eventType, details:inherited
    }), /minimization limit/);
    assert.equal(queries.length,0);

    // Only one JSON serialization is permitted: the first is oversized but
    // a second call would return a smaller value and falsely pass preflight.
    let calls = 0;
    const changing = {toJSON() {
      calls++;
      return {synthetic:'x'.repeat(calls === 1 ? 9000 : 5)};
    }};
    await assert.rejects(Ledger.recordEvent(db, {
      userId:KEY, eventType, details:changing
    }), /minimization limit/);
    assert.equal(calls,1,'toJSON must not be invoked a second time');
    assert.equal(queries.length,0);

    // JSON.stringify can return undefined for a custom serializer. Reject
    // it before SQL rather than passing an invalid JSONB parameter.
    await assert.rejects(Ledger.recordEvent(db, {
      userId:KEY, eventType, details:{toJSON(){return undefined;}}
    }), /Invalid GDPR outbox JSON details/);
    assert.equal(queries.length,0);

    // A Date serializes to an ISO string (not an empty plain object). The
    // exact SQL parameter must be accepted and remain B2-normalizable.
    const valid = await Ledger.recordEvent(db, {
      userId:KEY, eventType,
      details:{at:new Date('2026-10-26T00:00:00.000Z'), source:'x'.repeat(7900)}
    });
    assert.equal(valid.event_key,'synthetic-test-event');
    assert.equal(queries.length,1);
    assert.match(queries[0].sql,/INSERT INTO privacy_erasure_delivery_outbox/);
    const actualDetails = JSON.parse(queries[0].params[3]);
    assert.equal(actualDetails.at,'2026-10-26T00:00:00.000Z');
    assert.doesNotThrow(() => normalizeB2Event({
      event_key: '00000000-0000-4000-8000-000000000321',
      subject_user_id: KEY, event_type: eventType,
      occurred_at: '2026-10-26T00:00:00.000Z', details: actualDetails
    }));
  } finally {
    if (previous === undefined) delete process.env.GDPR_ERASURE_OUTBOX_ENABLED;
    else process.env.GDPR_ERASURE_OUTBOX_ENABLED = previous;
  }
});

test('HMAC is stable regardless of object key order and PostgreSQL JSONB property order', () => {
  const event = mkEvent();
  const reordered = { ...event, details: { z: 1, action: 'test' } };
  assert.equal(signature(fixture([event]).payload, SECRET),
    signature(fixture([reordered]).payload, SECRET));
});
test('signed recovery snapshot verifies only for exact approved session', () => {
  const envelope = fixture();
  const value = verifySignedManifest(envelope, SECRET, ID);
  assert.equal(value.events.length, 1);
  assert.throws(() => verifySignedManifest(envelope, SECRET, 'wrong_recovery_20261026'),
    /Recovery session/);
  assert.throws(() => verifySignedManifest(envelope, 'wrong-signing-secret-32-characters-long', ID),
    /signature invalid/);
});
test('unsigned, truncated, tampered and duplicate recovery evidence fail closed', () => {
  const original = fixture();
  assert.throws(() => verifySignedManifest({ payload: original.payload }, SECRET, ID), /Missing signed/);
  assert.throws(() => verifySignedManifest({ ...original, signature: 'a'.repeat(32) }, SECRET, ID), /Missing signed/);
  const changed = structuredClone(original);
  changed.payload.events[0].subject_user_id = 'other-person';
  assert.throws(() => verifySignedManifest(changed, SECRET, ID), /signature invalid/);
});
test('duplicate events, events after capture and malformed timestamps fail during signing', () => {
  const event = mkEvent();
  assert.throws(() => fixture([event, { ...event }]), /Repeated event/);
  assert.throws(() => fixture([mkEvent('political_consent_revoked', {
    occurred_at: '2026-10-27T00:00:00Z'
  })]), /after manifest/);
  assert.throws(() => fixture([mkEvent('political_consent_revoked', { occurred_at: 'bad' })]),
    /Invalid event timestamp/);
});
test('mixed-case GDPR event UUID is rejected before signing or database access', async () => {
  const noncanonical = mkEvent('political_consent_revoked', {
    event_key: 'ABCDEF12-3456-4ABC-8DEF-123456789ABC'
  });
  assert.throws(() => fixture([noncanonical]), /Invalid signed privacy recovery event/);
  let queries = 0;
  const client = {async query(){ queries++; throw Error('Unexpected SQL'); }};
  await assert.rejects(reconcileRestoredPrivacyState({
    client,
    envelope: {payload:{
      formatVersion:1,recoveryId:ID,capturedAt:'2026-10-26T01:00:00.000Z',
      restoredBackupTakenAt:'2026-10-24T00:00:00.000Z',events:[noncanonical]
    },signature:'a'.repeat(64)},
    secret:SECRET,expectedRecoveryId:ID,maintenanceConfirmed:true
  }), /Invalid signed privacy recovery event/);
  assert.equal(queries,0);
});

test('signed recovery refuses events that cannot fit the immutable B2 archive before any I/O', async () => {
  // B2 archiveEvent normalizes canonical JSON and refuses >8192 bytes.
  // Without matching validation here, a valid signed recovery could commit
  // an oversized event that the B2 worker can never deliver.
  const within = mkEvent('political_consent_revoked', {
    details: {synthetic: 'x'.repeat(7900)}
  });
  assert.doesNotThrow(() => fixture([within]));
  assert.doesNotThrow(() => normalizeB2Event(within));
  const oversized = mkEvent('political_consent_revoked', {
    details: {synthetic: 'x'.repeat(9000)}
  });
  assert.throws(() => fixture([oversized]), /B2 archive limit/);
  assert.throws(() => normalizeB2Event(oversized), /minimization limit/);

  // An attacker-supplied signed-looking manifest must be rejected during
  // normalization, without connecting to PostgreSQL or contacting B2.
  const payload = {
    formatVersion:1,recoveryId:ID,
    capturedAt:'2026-10-26T01:00:00.000Z',
    restoredBackupTakenAt:'2026-10-24T00:00:00.000Z',
    events:[oversized]
  };
  const envelope = {payload,signature:'a'.repeat(64)};
  let sql = 0, network = 0;
  const client = {async query(){sql++;throw Error('unexpected SQL');}};
  const exporter = {
    config(){network++;throw Error('unexpected B2');},
    async verifyArchivedReceipt(){network++;throw Error('unexpected B2');}
  };
  await assert.rejects(reconcileRestoredPrivacyState({
    client,envelope,secret:SECRET,expectedRecoveryId:ID,
    maintenanceConfirmed:true
  }),/B2 archive limit/);
  await assert.rejects(verifyOutboxRecoveryReadiness(client,{
    maintenanceConfirmed:true,exporter,envelope,secret:SECRET,
    expectedRecoveryId:ID
  }),/B2 archive limit/);
  assert.equal(sql,0);
  assert.equal(network,0);
});

test('opposing consent events at the same millisecond cannot be signed or replayed', async () => {
  const sameInstant = '2026-10-26T00:00:00.000Z';
  const revoke = mkEvent('political_consent_revoked', {occurred_at:sameInstant});
  const grant = mkEvent('political_consent_granted', {
    occurred_at:'2026-10-26T00:00:00.000500Z'
  });
  assert.throws(() => fixture([revoke, grant]), /Ambiguous simultaneous GDPR consent/);
  // No DB query may be attempted even if a caller supplies a signed-looking
  // envelope. The collision is rejected during payload normalization.
  const payload = {
    formatVersion:1, recoveryId:ID, capturedAt:'2026-10-26T01:00:00.000Z',
    restoredBackupTakenAt:'2026-10-24T00:00:00.000Z',
    events:[revoke,grant]
  };
  let queries = 0;
  await assert.rejects(reconcileRestoredPrivacyState({
    client:{async query(){queries++;}},
    envelope:{payload,signature:'a'.repeat(64)},
    secret:SECRET,expectedRecoveryId:ID,maintenanceConfirmed:true
  }), /Ambiguous simultaneous GDPR consent/);
  assert.equal(queries,0);
});

test('pinned external SHA256 refuses signed stale manifests without any DB access', async () => {
  const approved = fixture();
  const stale = fixture([mkEvent('political_consent_revoked',{
    occurred_at:'2026-10-25T00:00:00.000Z'
  })]);
  const checkpoint = {
    expectedManifestDigest: manifestDigest(approved),
    expectedRestoredBackupTakenAt: approved.payload.restoredBackupTakenAt,
    expectedCapturedAt: approved.payload.capturedAt
  };
  assert.doesNotThrow(()=>assertIndependentRecoveryCheckpoint(approved,checkpoint));
  assert.throws(()=>assertIndependentRecoveryCheckpoint(stale,checkpoint),/freshness checkpoint/);
  assert.throws(()=>assertIndependentRecoveryCheckpoint(approved,{
    ...checkpoint,expectedRestoredBackupTakenAt:'2026-10-23T00:00:00Z'
  }),/dates mismatch/);
  let queries=0;
  const client={async query(){queries++;}};
  await assert.rejects(reconcileRestoredPrivacyState({
    client,envelope:stale,secret:SECRET,expectedRecoveryId:ID,
    maintenanceConfirmed:true,...checkpoint
  }),/freshness checkpoint/);
  await assert.rejects(reconcileRestoredPrivacyState({
    client,envelope:approved,secret:SECRET,expectedRecoveryId:ID,
    maintenanceConfirmed:true
  }),/checkpoint is required/);
  assert.equal(queries,0);
});
test('recovery rejects a missing maintenance attestation BEFORE connecting to DB', async () => {
  let queries = 0;
  await assert.rejects(reconcileRestoredPrivacyState({
    client: { async query() { queries++; } },
    envelope: fixture(), secret: SECRET, expectedRecoveryId: ID,
    maintenanceConfirmed: false
  }), /maintenance/);
  assert.equal(queries, 0);
});
test('B2 readiness requires independently approved signed history before any DB or network access', async () => {
  let sql = 0, remote = 0;
  const client = { async query() { sql++; throw Error('unexpected-sql'); } };
  const exporter = {
    config() { remote++; throw Error('unexpected-remote'); },
    async verifyArchivedReceipt() { remote++; throw Error('unexpected-remote'); }
  };
  await assert.rejects(verifyOutboxRecoveryReadiness(client,{
    maintenanceConfirmed:true,exporter
  }),/Missing signed/);
  const envelope = fixture();
  await assert.rejects(verifyOutboxRecoveryReadiness(client,{
    maintenanceConfirmed:true,exporter,envelope,secret:SECRET,expectedRecoveryId:ID,
    expectedManifestDigest:'f'.repeat(64),
    expectedRestoredBackupTakenAt:envelope.payload.restoredBackupTakenAt,
    expectedCapturedAt:envelope.payload.capturedAt
  }),/freshness checkpoint/);
  assert.equal(sql,0);
  assert.equal(remote,0);
});

test('B2 readiness refuses orphaned delivery rows before any remote object read', async () => {
  const envelope = fixture();
  const sql = [];
  let remoteReads = 0;
  const client = { async query(statement) {
    sql.push(statement);
    if (statement.startsWith('BEGIN TRANSACTION') ||
        statement === 'SET LOCAL search_path = pg_catalog, public, pg_temp') return {rows:[]};
    if (statement.includes("to_regclass('public.privacy_erasure_ledger')")) {
      return {rows:[{ledger:true,outbox:true}]};
    }
    if (statement.includes('FROM privacy_erasure_delivery_outbox o')) {
      return {rows:[{present:true}]};
    }
    if (statement === 'ROLLBACK') return {rows:[]};
    throw Error('Unexpected SQL after orphan detection');
  }};
  const exporter = {
    config() { return {}; },
    async verifyArchivedReceipt() { remoteReads++; throw Error('Unexpected B2 GET'); }
  };
  await assert.rejects(verifyOutboxRecoveryReadiness(client, {
    maintenanceConfirmed:true,exporter,envelope,secret:SECRET,expectedRecoveryId:ID,
    expectedManifestDigest:manifestDigest(envelope),
    expectedRestoredBackupTakenAt:envelope.payload.restoredBackupTakenAt,
    expectedCapturedAt:envelope.payload.capturedAt
  }), /orphaned events/);
  assert.equal(remoteReads,0);
  assert.ok(sql.includes('ROLLBACK'));
  assert.equal(sql.some(statement => statement.includes('ORDER BY l.event_key')),false);
});

test('B2 readiness rolls back when an immutable remote receipt disappears during verification', async () => {
  const envelope = fixture();
  const event = envelope.payload.events[0];
  const statements = [];
  let remoteReads = 0;
  const client = { async query(statement) {
    statements.push(statement);
    if (statement.startsWith('BEGIN TRANSACTION') ||
        statement === 'SET LOCAL search_path = pg_catalog, public, pg_temp') return {rows:[]};
    if (statement.includes("to_regclass('public.privacy_erasure_ledger')")) {
      return {rows:[{ledger:true,outbox:true}]};
    }
    if (statement.includes('FROM privacy_erasure_delivery_outbox o')) {
      return {rows:[{present:false}]};
    }
    if (statement.includes('ORDER BY l.event_key')) {
      return {rows:[{...event,delivered_at:'2026-10-26T00:30:00.000Z',
        b2_version_id:'synthetic-version',b2_sha256:'a'.repeat(64)}]};
    }
    if (statement === 'ROLLBACK') return {rows:[]};
    throw Error('Unexpected SQL during failed remote verification');
  }};
  const exporter = {
    config() { return {}; },
    async verifyArchivedReceipt() {
      remoteReads++;
      throw Error('Synthetic B2 version unavailable');
    }
  };
  await assert.rejects(verifyOutboxRecoveryReadiness(client, {
    maintenanceConfirmed:true,exporter,envelope,secret:SECRET,expectedRecoveryId:ID,
    expectedManifestDigest:manifestDigest(envelope),
    expectedRestoredBackupTakenAt:envelope.payload.restoredBackupTakenAt,
    expectedCapturedAt:envelope.payload.capturedAt
  }), /Synthetic B2 version unavailable/);
  assert.equal(remoteReads,1);
  assert.ok(statements.includes('ROLLBACK'));
  assert.equal(statements.includes('COMMIT'),false);
});

test('B2 readiness refuses missing delivery receipt before remote reads and rolls back', async () => {
  const envelope = fixture();
  const event = envelope.payload.events[0];
  const statements = [];
  let remoteReads = 0;
  const client = { async query(statement) {
    statements.push(statement);
    if (statement.startsWith('BEGIN TRANSACTION') ||
        statement === 'SET LOCAL search_path = pg_catalog, public, pg_temp') return {rows:[]};
    if (statement.includes("to_regclass('public.privacy_erasure_ledger')")) {
      return {rows:[{ledger:true,outbox:true}]};
    }
    if (statement.includes('FROM privacy_erasure_delivery_outbox o')) {
      return {rows:[{present:false}]};
    }
    if (statement.includes('ORDER BY l.event_key')) {
      return {rows:[{...event,delivered_at:null,b2_version_id:null,b2_sha256:null}]};
    }
    if (statement === 'ROLLBACK') return {rows:[]};
    throw Error('Unexpected SQL after missing receipt');
  }};
  const exporter = {
    config() { return {}; },
    async verifyArchivedReceipt() { remoteReads++; throw Error('Unexpected B2 GET'); }
  };
  await assert.rejects(verifyOutboxRecoveryReadiness(client, {
    maintenanceConfirmed:true,exporter,envelope,secret:SECRET,expectedRecoveryId:ID,
    expectedManifestDigest:manifestDigest(envelope),
    expectedRestoredBackupTakenAt:envelope.payload.restoredBackupTakenAt,
    expectedCapturedAt:envelope.payload.capturedAt
  }), /no verified external delivery receipt/);
  assert.equal(remoteReads,0);
  assert.ok(statements.includes('ROLLBACK'));
  assert.equal(statements.includes('COMMIT'),false);
});

function syntheticB2ReadinessDb(events) {
  const queries = [];
  const rows = events.map(event => ({
    ...event, delivered_at: '2026-10-26T00:00:00.000Z',
    b2_version_id: 'synthetic-locked-version', b2_sha256: 'a'.repeat(64)
  })).sort((a,b) => a.event_key.localeCompare(b.event_key));
  const client = {async query(sql, params=[]) {
    queries.push(sql);
    if (sql.startsWith('BEGIN TRANSACTION') ||
        sql === 'SET LOCAL search_path = pg_catalog, public, pg_temp') return {rows:[]};
    if (sql.includes("to_regclass('public.privacy_erasure_ledger')")) {
      return {rows:[{ledger:true,outbox:true}]};
    }
    if (sql.includes('FROM privacy_erasure_delivery_outbox o')) {
      return {rows:[{present:false}]};
    }
    if (sql.includes('ORDER BY l.event_key')) {
      return {rows:rows.filter(row => row.event_key > params[0]).slice(0,params[1])};
    }
    if (sql === 'ROLLBACK' || sql === 'COMMIT') return {rows:[]};
    throw Error('Unexpected synthetic readiness SQL');
  }};
  return {client,queries};
}

test('B2 readiness rejects an early Object Lock expiry after later receipts finish', async () => {
  const envelope = fixture([mkEvent(),mkEvent()]);
  const {client,queries} = syntheticB2ReadinessDb(envelope.payload.events);
  let now = new Date('2026-10-26T00:00:00.000Z');
  let reads = 0;
  const exporter = {
    config() { return {}; },
    async verifyArchivedReceipt(_row, receipt) {
      reads++;
      if (reads === 2) now = new Date('2026-10-26T00:00:02.000Z');
      return {...receipt, retentionUntil: reads === 1
        ? '2026-10-26T00:00:01.000Z' : '2026-10-26T00:00:10.000Z'};
    }
  };
  await assert.rejects(verifyOutboxRecoveryReadiness(client, {
    maintenanceConfirmed:true,exporter,envelope,secret:SECRET,expectedRecoveryId:ID,
    expectedManifestDigest:manifestDigest(envelope),
    expectedRestoredBackupTakenAt:envelope.payload.restoredBackupTakenAt,
    expectedCapturedAt:envelope.payload.capturedAt,
    pageSize:1,clock:()=>new Date(now)
  }), /Object Lock expired during full recovery verification/);
  assert.equal(reads,2,'both individual B2 checks completed before batch expiry');
  assert.ok(queries.includes('ROLLBACK'));
  assert.equal(queries.includes('COMMIT'),false);
});

test('B2 readiness requires verifiable expiry and accepts retained full batch', async () => {
  const envelope = fixture();
  const approved = {
    maintenanceConfirmed:true,envelope,secret:SECRET,expectedRecoveryId:ID,
    expectedManifestDigest:manifestDigest(envelope),
    expectedRestoredBackupTakenAt:envelope.payload.restoredBackupTakenAt,
    expectedCapturedAt:envelope.payload.capturedAt,
    clock:()=>new Date('2026-10-26T00:00:00.000Z')
  };
  const bad = syntheticB2ReadinessDb(envelope.payload.events);
  await assert.rejects(verifyOutboxRecoveryReadiness(bad.client,{
    ...approved,exporter:{
      config(){return {};},
      async verifyArchivedReceipt(_row, receipt){return {...receipt};}
    }
  }),/omitted a valid retention expiry/);
  assert.ok(bad.queries.includes('ROLLBACK'));
  assert.equal(bad.queries.includes('COMMIT'),false);
  const good = syntheticB2ReadinessDb(envelope.payload.events);
  const result = await verifyOutboxRecoveryReadiness(good.client,{
    ...approved,exporter:{
      config(){return {};},
      async verifyArchivedReceipt(_row, receipt){return {...receipt,retentionUntil:'2026-10-26T00:00:10.000Z'};}
    }
  });
  assert.deepEqual(result,{ready:true,verifiedEvents:1,pinnedEvents:1});
  const pin=good.queries.indexOf('SET LOCAL search_path = pg_catalog, public, pg_temp');
  const firstSchemaRead=good.queries.findIndex(sql=>sql.includes("to_regclass('public.privacy_erasure_ledger')"));
  assert.ok(pin>0 && firstSchemaRead>pin,
    'pin verified public schema before any ledger/outbox reads');
  assert.ok(good.queries.includes('COMMIT'));
  assert.equal(good.queries.includes('ROLLBACK'),false);
});


test('B2 readiness rejects verifier response with absent or mismatched immutable receipt identity', async () => {
  const envelope = fixture();
  const opts = {
    maintenanceConfirmed:true,envelope,secret:SECRET,expectedRecoveryId:ID,
    expectedManifestDigest:manifestDigest(envelope),
    expectedRestoredBackupTakenAt:envelope.payload.restoredBackupTakenAt,
    expectedCapturedAt:envelope.payload.capturedAt,
    clock:()=>new Date('2026-10-26T00:00:00.000Z')
  };
  const cases = [
    {name:'missing both', response:()=>({retentionUntil:'2026-10-27T00:00:00.000Z'})},
    {name:'wrong version', response:receipt=>({
      ...receipt,versionId:'different-immutable-B2-version',
      retentionUntil:'2026-10-27T00:00:00.000Z'
    })},
    {name:'wrong SHA256', response:receipt=>({
      ...receipt,sha256:'f'.repeat(64),
      retentionUntil:'2026-10-27T00:00:00.000Z'
    })},
    {name:'missing SHA256', response:receipt=>({
      versionId:receipt.versionId,retentionUntil:'2026-10-27T00:00:00.000Z'
    })}
  ];
  for (const fixtureCase of cases) {
    const {client, queries} = syntheticB2ReadinessDb(envelope.payload.events);
    let checks = 0;
    await assert.rejects(verifyOutboxRecoveryReadiness(client,{
      ...opts,exporter:{
        config(){return {};},
        async verifyArchivedReceipt(_row,receipt) {
          checks++;
          return fixtureCase.response(receipt);
        }
      }
    }),/B2 receipt verifier returned mismatched version or SHA256/,
    fixtureCase.name);
    assert.equal(checks,1,fixtureCase.name);
    assert.ok(queries.includes('ROLLBACK'),fixtureCase.name);
    assert.equal(queries.includes('COMMIT'),false,fixtureCase.name);
  }
});

test('recovery HTTP middleware refuses health, GET, write and OPTIONS with no-store', async () => {
  const previous = process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE;
  const app = express();
  app.use(privacyRecoveryMaintenance);
  app.all('/api/health', (_req, res) => res.status(200).end());
  app.all('/api/opinioni/salva', (_req, res) => res.status(200).end());
  const server = http.createServer(app);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const port = server.address().port;
    process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = 'true';
    for (const [route, method] of [['/api/health', 'GET'], ['/api/opinioni/salva', 'POST'],
      ['/api/opinioni/salva', 'OPTIONS']]) {
      const response = await fetch('http://127.0.0.1:' + port + route, { method });
      assert.equal(response.status, 503);
      assert.equal(response.headers.get('cache-control'), 'private, no-store, max-age=0');
      assert.equal((await response.json()).code, 'GDPR_RECOVERY_MAINTENANCE');
    }
    // A typo in the recovery switch must NOT silently reopen traffic.
    for (const malformed of ['TRUE', 'true ', 'FALSE', 'false ', '0', '']) {
      process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = malformed;
      for (const [route, method] of [['/api/health', 'GET'],
        ['/api/opinioni/salva', 'POST'], ['/api/opinioni/salva', 'OPTIONS']]) {
        const blocked = await fetch('http://127.0.0.1:' + port + route, { method });
        assert.equal(blocked.status, 503,
          'Malformed maintenance flag must not serve ' + method + ' ' + route);
        assert.equal(blocked.headers.get('cache-control'),
          'private, no-store, max-age=0');
        assert.equal((await blocked.json()).code, 'GDPR_RECOVERY_MAINTENANCE');
      }
    }
    process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = 'false';
    assert.equal((await fetch('http://127.0.0.1:' + port + '/api/health')).status, 200);
    delete process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE;
    assert.equal((await fetch('http://127.0.0.1:' + port + '/api/health')).status, 200);
  } finally {
    if (previous === undefined) delete process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE;
    else process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE = previous;
    await new Promise(resolve => server.close(resolve));
  }
});
test('main app mounts recovery gate before CORS OPTIONS, logging and routes', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'app.js'), 'utf8');
  const i = src.indexOf('app.use(privacyRecoveryMaintenance)');
  assert.ok(i > src.indexOf('const app = express()'));
  assert.ok(i < src.indexOf('app.options('));
  assert.ok(i < src.indexOf("app.use('/api', healthRoutes)"));
});


test('dual-loss drill: independently pinned later event missing from both restored DB and B2 blocks readiness', async () => {
  // A was archived before the backup; B committed AFTER the backup but was
  // not yet delivered to B2 when the database failed. Both are invented.
  // The trusted manifest/checkpoint was captured outside the failed DB.
  const archived = mkEvent('political_consent_revoked', {
    occurred_at: '2026-10-25T00:10:00.000Z'
  });
  const lost = mkEvent('political_consent_revoked', {
    occurred_at: '2026-10-26T00:45:00.000Z'
  });
  const latest = fixture([archived, lost]);
  const {client, queries} = syntheticB2ReadinessDb([archived]);
  let remoteReads = 0;
  const exporter = {
    config() { return {}; },
    async verifyArchivedReceipt(row, receipt) {
      remoteReads++;
      assert.equal(row.event_key, archived.event_key,
        'a lost event must not be fabricated as a B2 receipt');
      return {...receipt, retentionUntil: '2026-10-27T00:00:00.000Z'};
    }
  };
  await assert.rejects(verifyOutboxRecoveryReadiness(client, {
    maintenanceConfirmed: true, exporter, envelope: latest,
    secret: SECRET, expectedRecoveryId: ID,
    expectedManifestDigest: manifestDigest(latest),
    expectedRestoredBackupTakenAt: latest.payload.restoredBackupTakenAt,
    expectedCapturedAt: latest.payload.capturedAt,
    clock: () => new Date('2026-10-26T01:00:00.000Z'),
    pageSize: 1
  }), /events missing from restored ledger/);
  assert.equal(remoteReads, 1, 'only surviving A has an archived receipt');
  assert.ok(queries.includes('ROLLBACK'));
  assert.equal(queries.includes('COMMIT'), false);
});

test('dual-loss drill: stale signed manifest refused by newer independent pin before DB or B2 access', async () => {
  const archived = mkEvent('political_consent_revoked', {
    occurred_at: '2026-10-25T00:10:00.000Z'
  });
  const lost = mkEvent('political_consent_revoked', {
    occurred_at: '2026-10-26T00:45:00.000Z'
  });
  const stale = fixture([archived]); // Correctly signed, but incomplete.
  const latest = fixture([archived, lost]); // Independent trusted evidence.
  assert.notEqual(manifestDigest(stale), manifestDigest(latest));
  let sql = 0, b2 = 0;
  const client = {async query() { sql++; throw Error('unexpected SQL'); }};
  const exporter = {
    config() { b2++; throw Error('unexpected B2 config'); },
    async verifyArchivedReceipt() { b2++; throw Error('unexpected B2 GET'); }
  };
  await assert.rejects(verifyOutboxRecoveryReadiness(client, {
    maintenanceConfirmed: true, exporter, envelope: stale,
    secret: SECRET, expectedRecoveryId: ID,
    expectedManifestDigest: manifestDigest(latest),
    expectedRestoredBackupTakenAt: latest.payload.restoredBackupTakenAt,
    expectedCapturedAt: latest.payload.capturedAt
  }), /freshness checkpoint/);
  assert.equal(sql, 0);
  assert.equal(b2, 0);
  // This function cannot prove that the supplied trusted checkpoint is the
  // NEWEST one. An out-of-band checkpoint authority/incident decision is
  // still mandatory; neither a signed manifest nor a local 'ready' proves it.
});
