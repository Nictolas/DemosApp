'use strict';

/*
 * End-to-end physical pg_dump/pg_restore drill against disposable GitHub
 * Actions PostgreSQL 17. Uses only invented UUIDs and synthetic-only creds.
 * Never run this script with production or provider database credentials.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');
const { Pool } = require('pg');
const Ledger = require('../services/privacyErasureLedgerService');
const { cleanupConsentScopedPoliticalData } = require('../services/politicalConsentService');
const { signature, manifestDigest, reconcileRestoredPrivacyState } = require('../services/privacyRecoveryGateService');

const DB = 'privacy_recovery_gate_ci';
const SESSION = 'real_dump_restore_ci_20261026';
const SECRET = 'synthetic-drill-key-not-a-deployment-secret-20261026';
const SUBJECTS = {
  revoked: '00000000-0000-4000-8000-000000000311',
  regranted: '00000000-0000-4000-8000-000000000312',
  deleted: '00000000-0000-4000-8000-000000000313',
  unaffected: '00000000-0000-4000-8000-000000000314'
};

function guard() {
  const env = process.env;
  if (env.GITHUB_ACTIONS !== 'true' ||
      env.PRIVACY_RECOVERY_CI !== 'isolated' ||
      env.PGHOST !== '127.0.0.1' ||
      env.PGPORT !== '5432' ||
      env.PGDATABASE !== DB ||
      env.PGUSER !== 'postgres' ||
      env.PGPASSWORD !== 'synthetic-only' ||
      ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_DB_URL',
       'SUPABASE_SERVICE_ROLE_KEY', 'RENDER', 'NEON_DATABASE_URL']
        .some(k => Boolean(env[k]))) {
    throw Error('Refusing physical restore drill outside disposable CI');
  }
}

function sourcePool(database = DB) {
  return new Pool({
    host: '127.0.0.1', port: 5432, database,
    user: 'postgres', password: 'synthetic-only',
    max: 1, connectionTimeoutMillis: 5000, statement_timeout: 20000
  });
}

function dockerPostgres(tool, args, tempDir) {
  const command = ['run', '--rm', '--network', 'host', '--mount',
    'type=bind,src=' + tempDir + ',dst=/restore',
    '-e', 'PGPASSWORD=synthetic-only', 'postgres:17', tool, ...args];
  const result = spawnSync('docker', command, {
    encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024
  });
  if (result.error || result.status !== 0) {
    throw Error('Disposable PostgreSQL ' + tool + ' command failed');
  }
}

async function count(db, table, userId) {
  assert.ok(['users', 'political_selections', 'user_representatives',
    'user_consents', 'opinioni_risposte'].includes(table));
  const column = table === 'users' ? 'id' : 'user_id';
  const result = await db.query(
    'SELECT COUNT(*)::int AS n FROM "' + table + '" WHERE "' + column + '"=$1',
    [userId]
  );
  return Number(result.rows[0].n);
}

async function seed(db) {
  const info = (await db.query(
    "SELECT current_database() AS db, current_setting('server_version_num')::int AS v"
  )).rows[0];
  assert.equal(info.db, DB);
  assert.equal(Math.floor(info.v / 10000), 17);
  await db.query('CREATE TABLE users(id uuid PRIMARY KEY,nome text NOT NULL,ruolo text NOT NULL,political_opinions_consent boolean NOT NULL,rappresentante_camera uuid,candidato_comune uuid,political_opinions_consent_timestamp timestamptz,political_opinions_consent_ip_address text,political_opinions_consent_user_agent text,updated_at timestamptz DEFAULT NOW())');
  await db.query('CREATE TABLE user_consents(user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,political_opinions_consent boolean,political_opinions_consent_timestamp timestamptz,political_opinions_consent_ip_address text,political_opinions_consent_user_agent text,updated_at timestamptz DEFAULT NOW())');
  await db.query('CREATE TABLE opinioni_risposte(user_id uuid PRIMARY KEY,energia_nucleare text)');
  await db.query('CREATE TABLE political_selections(user_id uuid NOT NULL,selected_user_id uuid NOT NULL,selection_kind text NOT NULL)');
  await db.query('CREATE TABLE user_representatives(user_id uuid PRIMARY KEY,rappresentante_camera uuid,candidato_comune uuid)');
  await Ledger.ensureTable(db);

  for (const [kind, id] of Object.entries(SUBJECTS)) {
    await db.query(
      "INSERT INTO users(id,nome,ruolo,political_opinions_consent,rappresentante_camera,candidato_comune) VALUES($1,$2,'E',true,$3,$3)",
      [id, 'Invented ' + kind, SUBJECTS.unaffected]
    );
    await db.query('INSERT INTO user_consents(user_id,political_opinions_consent) VALUES($1,true)', [id]);
    await db.query("INSERT INTO opinioni_risposte(user_id,energia_nucleare) VALUES($1,'f')", [id]);
    await db.query(
      "INSERT INTO political_selections(user_id,selected_user_id,selection_kind) VALUES($1,$2,'candidate')",
      [id, kind === 'unaffected' ? SUBJECTS.revoked : SUBJECTS.unaffected]
    );
    await db.query(
      'INSERT INTO user_representatives(user_id,rappresentante_camera,candidato_comune) VALUES($1,$2,$2)',
      [id, SUBJECTS.unaffected]
    );
  }
}

async function revokeAndRecord(db, subject) {
  await db.query('BEGIN');
  try {
    await db.query('UPDATE users SET political_opinions_consent=false WHERE id=$1', [subject]);
    await db.query('UPDATE user_consents SET political_opinions_consent=false WHERE user_id=$1', [subject]);
    await cleanupConsentScopedPoliticalData(db, subject);
    await Ledger.recordEvent(db, {
      userId: subject, eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
      details: { source: 'physical-backup-ci' }
    });
    await db.query('COMMIT');
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  guard();
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-real-restore-ci-'));
  const dumpPath = path.join(tempDir, 'pre-revocation.dump');
  const externalManifest = path.join(tempDir, 'external-erasure.json');
  let dbPool = sourcePool();
  const adminPool = sourcePool('postgres');
  let db;
  try {
    db = await dbPool.connect();
    await seed(db);
    const backupTakenAt = new Date(Date.now() - 3000).toISOString();
    dockerPostgres('pg_dump', [
      '-h','127.0.0.1','-p','5432','-U','postgres','-d',DB,
      '--format=custom','--no-owner','--no-acl','--file=/restore/pre-revocation.dump'
    ], tempDir);
    assert.ok(fs.statSync(dumpPath).size > 2000, 'Actual custom-format PostgreSQL backup missing');
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM privacy_erasure_ledger')).rows[0].n, 0);

    // Later GDPR changes happen AFTER the dump, and are preserved only by
    // the separately signed external manifest before losing the original DB.
    await revokeAndRecord(db, SUBJECTS.revoked);
    await delay(12);
    await revokeAndRecord(db, SUBJECTS.regranted);
    await delay(12);
    await db.query('BEGIN');
    try {
      await db.query('UPDATE users SET political_opinions_consent=true WHERE id=$1', [SUBJECTS.regranted]);
      await db.query('UPDATE user_consents SET political_opinions_consent=true WHERE user_id=$1', [SUBJECTS.regranted]);
      await Ledger.recordEvent(db, {
        userId: SUBJECTS.regranted, eventType: Ledger.EVENT_TYPES.POLITICAL_CONSENT_GRANTED,
        details: { source: 'physical-backup-ci' }
      });
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    await delay(12);
    await db.query('BEGIN');
    try {
      await Ledger.recordEvent(db, {
        userId: SUBJECTS.deleted, eventType: Ledger.EVENT_TYPES.ACCOUNT_DELETED,
        details: { source: 'physical-backup-ci' }
      });
      await Ledger.enforceAccountDeletion(db, SUBJECTS.deleted);
      await db.query('COMMIT');
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }

    assert.equal(await count(db, 'political_selections', SUBJECTS.revoked), 0);
    assert.equal(await count(db, 'political_selections', SUBJECTS.regranted), 0);
    assert.equal(await count(db, 'users', SUBJECTS.deleted), 0);
    assert.equal(await count(db, 'user_consents', SUBJECTS.deleted), 0);
    assert.equal(await count(db, 'user_representatives', SUBJECTS.deleted), 0);
    assert.equal(await count(db, 'political_selections', SUBJECTS.deleted), 0);
    assert.equal(await count(db, 'opinioni_risposte', SUBJECTS.deleted), 0);
    const events = await Ledger.captureCurrent(db);
    assert.equal(events.length, 4);
    const payload = {
      formatVersion: 1, recoveryId: SESSION,
      capturedAt: new Date().toISOString(),
      restoredBackupTakenAt: backupTakenAt,
      events
    };
    const envelope = { payload, signature: signature(payload, SECRET) };
    fs.writeFileSync(externalManifest, JSON.stringify(envelope), { mode: 0o600 });

    // Destroy the *entire source database* (synthetic fixed-name CI only):
    // the signed ledger now survives solely outside the database snapshot.
    db.release();
    db = null;
    await dbPool.end();
    dbPool = null;
    await adminPool.query('DROP DATABASE privacy_recovery_gate_ci WITH (FORCE)');
    await adminPool.query('CREATE DATABASE privacy_recovery_gate_ci');
    dockerPostgres('pg_restore', [
      '-h','127.0.0.1','-p','5432','-U','postgres','-d',DB,
      '--no-owner','--no-acl','--exit-on-error','/restore/pre-revocation.dump'
    ], tempDir);

    dbPool = sourcePool();
    db = await dbPool.connect();
    // Prove that the physical restore did, in fact, resurrect old choices.
    assert.equal(await count(db, 'users', SUBJECTS.deleted), 1);
    assert.equal(await count(db, 'political_selections', SUBJECTS.revoked), 1);
    assert.equal(await count(db, 'political_selections', SUBJECTS.regranted), 1);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM privacy_erasure_ledger')).rows[0].n, 0);

    const saved = JSON.parse(fs.readFileSync(externalManifest, 'utf8'));
    // A reference SHA-256 is pinned separately BEFORE reading the manifest.
    // Real recovery must obtain this reference from an independent trusted store.
    const approvedCheckpoint = {
      expectedManifestDigest: manifestDigest(envelope),
      expectedRestoredBackupTakenAt: backupTakenAt,
      expectedCapturedAt: payload.capturedAt
    };
    // Simulate an incomplete physical restore with the GDPR ledger schema
    // absent. The signed replay must not auto-create a replacement table.
    await db.query('DROP TABLE privacy_erasure_ledger');
    const noDdlClient = {
      async query(sql, params) {
        assert.doesNotMatch(String(sql), /\bCREATE\s+(?:TABLE|INDEX)\b/i,
          'offline recovery must not perform schema DDL');
        return db.query(sql, params);
      }
    };
    await assert.rejects(reconcileRestoredPrivacyState({
      client:noDdlClient,envelope:saved,secret:SECRET,
      expectedRecoveryId:SESSION,maintenanceConfirmed:true,...approvedCheckpoint
    }),/ledger schema missing/);
    assert.equal((await db.query(
      "SELECT to_regclass('public.privacy_erasure_ledger') AS relation"
    )).rows[0].relation,null);
    assert.equal(await count(db,'political_selections',SUBJECTS.revoked),1);
    // Explicit CI-only repair of the intentionally damaged disposable DB.
    await Ledger.ensureTable(db);

    await assert.rejects(reconcileRestoredPrivacyState({
      client: db, envelope: null, secret: SECRET,
      expectedRecoveryId: SESSION, maintenanceConfirmed: true, ...approvedCheckpoint
    }), /Missing signed/);
    await assert.rejects(reconcileRestoredPrivacyState({
      client: db, envelope: saved, secret: SECRET,
      expectedRecoveryId: SESSION, maintenanceConfirmed: false, ...approvedCheckpoint
    }), /maintenance/);
    // This manifest is itself correctly signed by the CI key but truncated:
    // the independently pinned digest must still reject it *before* any SQL.
    const stalePayload = {...saved.payload, events:saved.payload.events.slice(0,2)};
    const stale = {payload:stalePayload, signature:signature(stalePayload,SECRET)};
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:stale,secret:SECRET,
      expectedRecoveryId:SESSION,maintenanceConfirmed:true,...approvedCheckpoint
    }),/freshness checkpoint/);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM privacy_erasure_ledger')).rows[0].n,0);
    const forged = structuredClone(saved);
    forged.payload.events[0].subject_user_id = SUBJECTS.unaffected;
    await assert.rejects(reconcileRestoredPrivacyState({
      client: db, envelope: forged, secret: SECRET,
      expectedRecoveryId: SESSION, maintenanceConfirmed: true, ...approvedCheckpoint
    }), /signature invalid/);
    assert.equal(await count(db, 'political_selections', SUBJECTS.revoked), 1);

    // The physically restored database contains an additional historical
    // event that an otherwise authentic and independently pinned external
    // manifest omits. Recovery must refuse to continue or alter that event.
    const unexpectedKey = crypto.randomUUID();
    await db.query(
      'INSERT INTO privacy_erasure_ledger ' +
      '(event_key,subject_user_id,event_type,occurred_at,details) ' +
      'VALUES ($1,$2,$3,$4,$5::jsonb)',
      [unexpectedKey,SUBJECTS.unaffected,
        Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
        '2026-10-24T04:00:00.000Z',JSON.stringify({source:'synthetic-omitted'})]
    );
    await assert.rejects(reconcileRestoredPrivacyState({
      client: db, envelope: saved, secret: SECRET, expectedRecoveryId: SESSION,
      maintenanceConfirmed: true, ...approvedCheckpoint
    }), /absent from approved manifest/);
    assert.equal((await db.query(
      'SELECT COUNT(*)::int AS n FROM privacy_erasure_ledger WHERE event_key=$1',
      [unexpectedKey])).rows[0].n,1);
    assert.equal(await count(db,'political_selections',SUBJECTS.revoked),1);
    assert.equal(await count(db,'users',SUBJECTS.deleted),1);
    await db.query('DELETE FROM privacy_erasure_ledger WHERE event_key=$1',
      [unexpectedKey]);

    // A real pg_restore may contain a ledger but not an outbox table. The
    // operator must provision it explicitly while traffic is quarantined.
    process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'true';
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:saved,secret:SECRET,expectedRecoveryId:SESSION,
      maintenanceConfirmed:true,...approvedCheckpoint
    }),/outbox schema\/mode mismatch/);
    assert.equal((await db.query(
      'SELECT COUNT(*)::int AS n FROM privacy_erasure_ledger'
    )).rows[0].n,0);
    await Ledger.ensureDeliveryOutbox(db);
    // Fail *after* the ledger import but *before* deletion completes.
    const faultClient = {
      async query(sql, params) {
        if (String(sql).startsWith('DELETE FROM public.users WHERE id::text')) {
          throw Error('synthetic-restore-fault');
        }
        return db.query(sql, params);
      }
    };
    await assert.rejects(reconcileRestoredPrivacyState({
      client: faultClient, envelope: saved, secret: SECRET,
      expectedRecoveryId: SESSION, maintenanceConfirmed: true, ...approvedCheckpoint
    }), /synthetic-restore-fault/);
    assert.equal(await count(db, 'users', SUBJECTS.deleted), 1);
    assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM privacy_erasure_ledger')).rows[0].n, 0);

    const reconciled = await reconcileRestoredPrivacyState({
      client: noDdlClient, envelope: saved, secret: SECRET,
      expectedRecoveryId: SESSION, maintenanceConfirmed: true, ...approvedCheckpoint
    });
    assert.equal(reconciled.verifiedExternalEvents, 4);
    assert.equal(reconciled.imported, 4);
    assert.equal(reconciled.staleSnapshotRevocationsReapplied, 2);
    assert.equal(reconciled.outboxInserted,4);
    assert.equal(reconciled.pendingExternalReceipts,4);
    assert.equal(Number((await db.query(
      'SELECT count(*)::int AS n FROM privacy_erasure_delivery_outbox'
    )).rows[0].n),4);

    for (const id of [SUBJECTS.revoked, SUBJECTS.regranted]) {
      for (const table of ['political_selections','user_representatives','opinioni_risposte']) {
        assert.equal(await count(db, table, id), 0, table + ': stale political data');
      }
      const profile = (await db.query(
        'SELECT rappresentante_camera,candidato_comune FROM users WHERE id=$1',[id]
      )).rows[0];
      assert.equal(profile.rappresentante_camera, null);
      assert.equal(profile.candidato_comune, null);
    }
    assert.equal(await count(db, 'users', SUBJECTS.deleted), 0);
    assert.equal(await count(db, 'users', SUBJECTS.unaffected), 1);
    assert.equal(await count(db, 'political_selections', SUBJECTS.unaffected), 1);
    assert.equal(await count(db, 'opinioni_risposte', SUBJECTS.unaffected), 1);
    const regrantState = (await db.query(
      'SELECT political_opinions_consent FROM users WHERE id=$1',
      [SUBJECTS.regranted]
    )).rows[0];
    assert.equal(regrantState.political_opinions_consent, true);
    const again = await reconcileRestoredPrivacyState({
      client: noDdlClient, envelope: saved, secret: SECRET,
      expectedRecoveryId: SESSION, maintenanceConfirmed: true, ...approvedCheckpoint
    });
    assert.equal(again.imported, 0);
    assert.equal(again.outboxInserted,0);
    assert.equal(again.pendingExternalReceipts,4);

    console.log('GDPR_PHYSICAL_PGDUMP_PGRESTORE_CI_PASS ' + JSON.stringify({
      fixture: 'disposable-postgres-17',
      realDumpRestore: true, originalDbDestroyed: true,
      externalSignedLedgerSurvived: true,
      missingOrTamperedManifestRefused: true,
      validlySignedStaleManifestRefused: true,
      unapprovedRestoredLedgerEventRejected: true,
      missingOutboxSchemaRejected: true,
      missingLedgerSchemaRejectedWithoutDdl: true,
      replayZeroImplicitDdl: true,
      recoveredEventsQueuedForB2: true,
      rollbackAfterFailure: true, consentRegrantDidNotResurrectChoices: true,
      deletedAccountStayedDeleted: true, unaffectedUserPreserved: true,
      replayIdempotent: true, realDataTouched: false
    }));
  } finally {
    if (db) db.release();
    if (dbPool) await dbPool.end();
    await adminPool.end();
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}
main().catch(error => {
  console.error('GDPR_PHYSICAL_PGDUMP_PGRESTORE_CI_FAILED', error);
  process.exitCode = 1;
});
