'use strict';
/*
 * Isolated PostgreSQL 17 only. Simulates an old restored snapshot whose
 * personal selections precede a later signed, externally held revocation.
 * NEVER accepts a real database URL or Supabase/Render credentials.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Pool } = require('pg');
const Ledger = require('../services/privacyErasureLedgerService');
const PoliticalConsent = require('../services/politicalConsentService');
const { signature, manifestDigest, reconcileRestoredPrivacyState } = require('../services/privacyRecoveryGateService');
const DB = 'privacy_recovery_gate_ci';
const SUBJECT = '00000000-0000-4000-8000-000000000301';
const OTHER = '00000000-0000-4000-8000-000000000302';
const THIRD = '00000000-0000-4000-8000-000000000303';
const SECRET = 'synthetic-external-ledger-hmac-key-20261026-long';
const RECOVERY = 'recovery_synthetic_20261026';
function guard() {
  const e=process.env;
  if (e.GITHUB_ACTIONS!=='true'||e.PRIVACY_RECOVERY_CI!=='isolated'||
      e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
      e.PGDATABASE!==DB||e.PGUSER!=='postgres'||e.PGPASSWORD!=='synthetic-only'||
      e.DATABASE_URL||e.SUPABASE_URL||e.SUPABASE_DB_URL||e.SUPABASE_SERVICE_ROLE_KEY||e.RENDER) {
    throw Error('Refusing nonlocal privacy recovery test');
  }
}
const event = (subject, type, time, details = {}) => ({
  event_key: crypto.randomUUID(), subject_user_id: subject,
  event_type: type, occurred_at: time, details
});
function envelope(events, recoveryId=RECOVERY) {
  const payload={formatVersion:1,recoveryId,capturedAt:'2026-10-26T01:00:00.000Z',restoredBackupTakenAt:'2026-10-24T00:00:00.000Z',events};
  return {payload,signature:signature(payload,SECRET)};
}
// The CI synthetic fixture pins the digest in advance; production must source
// this approval from a *different* trusted channel than the JSON manifest.
function approvedCheckpoint(envelope) {
  return {expectedManifestDigest:manifestDigest(envelope),
    expectedRestoredBackupTakenAt:envelope.payload.restoredBackupTakenAt,
    expectedCapturedAt:envelope.payload.capturedAt};
}
async function count(db,table,subject) {
  const allowed=['opinioni_risposte','political_selections','user_representatives'];
  assert.ok(allowed.includes(table));
  return Number((await db.query(
    'SELECT count(*)::int AS n FROM "'+table+'" WHERE user_id=$1',[subject]
  )).rows[0].n);
}
async function valueForUser(db,table,subject) {
  // The table name comes ONLY from this fixed disposable CI fixture.
  assert.ok(new Set([
    'public.users','pg_temp.users','public.opinioni_risposte',
    'pg_temp.opinioni_risposte','public.political_selections',
    'pg_temp.political_selections'
  ]).has(table));
  const column=table.endsWith('.users')?'id':'user_id';
  return Number((await db.query(
    'SELECT count(*)::int AS n FROM '+table+' WHERE '+column+'=$1',
    [subject]
  )).rows[0].n);
}
async function setup(db) {
  const meta=(await db.query("SELECT current_database() AS n,current_setting('server_version_num')::integer AS v")).rows[0];
  assert.equal(meta.n,DB);
  assert.equal(Math.floor(meta.v/10000),17);
  await db.query('CREATE TABLE users(id uuid PRIMARY KEY,nome text NOT NULL,ruolo text NOT NULL,political_opinions_consent boolean NOT NULL,rappresentante_camera uuid,candidato_comune uuid,political_opinions_consent_timestamp timestamptz,political_opinions_consent_ip_address text,political_opinions_consent_user_agent text,updated_at timestamptz DEFAULT NOW())');
  await db.query('CREATE TABLE user_consents(user_id uuid PRIMARY KEY,political_opinions_consent boolean,political_opinions_consent_timestamp timestamptz,political_opinions_consent_ip_address text,political_opinions_consent_user_agent text,updated_at timestamptz DEFAULT NOW())');
  await db.query('CREATE TABLE opinioni_risposte(user_id uuid PRIMARY KEY,energia_nucleare text)');
  await db.query('CREATE TABLE political_selections(user_id uuid NOT NULL,selected_user_id uuid NOT NULL,selection_kind text NOT NULL)');
  await db.query('CREATE TABLE user_representatives(user_id uuid PRIMARY KEY,rappresentante_camera uuid,candidato_comune uuid)');
  for (const [id,label] of [[SUBJECT,'Subject'],[OTHER,'Other'],[THIRD,'Third']]) {
    await db.query('INSERT INTO users(id,nome,ruolo,political_opinions_consent,rappresentante_camera,candidato_comune) VALUES($1,$2,$3,true,$4,$4)',[id,label,'E',OTHER]);
    await db.query('INSERT INTO user_consents(user_id,political_opinions_consent) VALUES($1,true)',[id]);
    await db.query("INSERT INTO opinioni_risposte(user_id,energia_nucleare) VALUES($1,'f')",[id]);
    await db.query('INSERT INTO political_selections(user_id,selected_user_id,selection_kind) VALUES($1,$2,$3)',[id,id===OTHER?SUBJECT:OTHER,'candidate']);
    await db.query('INSERT INTO user_representatives(user_id,rappresentante_camera,candidato_comune) VALUES($1,$2,$2)',[id,OTHER]);
  }
}
async function main() {
  guard();
  const pool=new Pool({host:'127.0.0.1',port:5432,database:DB,user:'postgres',
    password:'synthetic-only',max:2,connectionTimeoutMillis:5000,statement_timeout:15000});
  const db=await pool.connect();
  try {
    await setup(db);
    // Test the LIVE cleanup helpers directly, outside the signed recovery
    // replay (which already pins search_path transaction-locally). Borrowed
    // connections must not let pg_temp shadow canonical personal-data tables.
    await db.query('BEGIN');
    try {
      await db.query(
        'CREATE TABLE public.comunicazioni ' +
        '(id uuid PRIMARY KEY,id_utente uuid,read_by uuid[])'
      );
      await db.query(
        'CREATE TABLE public.reazioni (utente_id uuid,comunicazione_id uuid)'
      );
      const ownedComm='00000000-0000-4000-8000-000000000401';
      const otherComm='00000000-0000-4000-8000-000000000402';
      await db.query(
        'INSERT INTO public.comunicazioni(id,id_utente,read_by) VALUES ' +
        '($1,$3,ARRAY[$3]::uuid[]),($2,$4,ARRAY[$3]::uuid[])',
        [ownedComm,otherComm,THIRD,OTHER]
      );
      await db.query(
        'INSERT INTO public.reazioni(utente_id,comunicazione_id) VALUES ' +
        '($1,$2),($3,$4)',[THIRD,otherComm,OTHER,ownedComm]
      );
      for (const [table,key] of [
        ['users','id'],['user_consents','user_id'],
        ['opinioni_risposte','user_id'],['political_selections','user_id'],
        ['user_representatives','user_id']
      ]) {
        await db.query(
          'CREATE TEMP TABLE "'+table+'" (LIKE public."'+table+'" INCLUDING DEFAULTS) ' +
          'ON COMMIT DROP'
        );
        await db.query(
          'INSERT INTO pg_temp."'+table+'" SELECT * FROM public."'+table+'" ' +
          'WHERE "'+key+'"=$1',[THIRD]
        );
      }
      for (const table of ['comunicazioni','reazioni']) {
        await db.query(
          'CREATE TEMP TABLE "'+table+'" (LIKE public."'+table+'" INCLUDING DEFAULTS) ' +
          'ON COMMIT DROP'
        );
        await db.query('INSERT INTO pg_temp."'+table+'" SELECT * FROM public."'+table+'"');
      }
      // Make the shadow consent disagree with the canonical table.
      await db.query(
        'UPDATE pg_temp.user_consents SET political_opinions_consent=false ' +
        'WHERE user_id=$1',[THIRD]
      );
      await db.query('SET LOCAL search_path = pg_temp, public');
      assert.deepEqual(await PoliticalConsent.getPoliticalConsentState(db,THIRD),
        {exists:true,granted:true},
        'political consent read must prefer verified public users/user_consents');
      await Ledger.enforcePoliticalRevocation(db,THIRD);
      assert.equal(await valueForUser(db,'public.opinioni_risposte',THIRD),0,
        'revocation must delete public political responses');
      assert.equal(await valueForUser(db,'public.political_selections',THIRD),0,
        'revocation must delete public personal political selections');
      assert.equal(await valueForUser(db,'pg_temp.opinioni_risposte',THIRD),1,
        'revocation must never delete shadow political responses');
      assert.equal(await valueForUser(db,'pg_temp.political_selections',THIRD),1,
        'revocation must never delete shadow political selections');
      const revokedPublic=await db.query(
        'SELECT political_opinions_consent FROM public.users WHERE id=$1',[THIRD]
      );
      assert.equal(revokedPublic.rows[0].political_opinions_consent,false);
      const revokedConsent=await db.query(
        'SELECT political_opinions_consent FROM public.user_consents WHERE user_id=$1',[THIRD]
      );
      assert.equal(revokedConsent.rows[0].political_opinions_consent,false);
      assert.equal(await valueForUser(db,'pg_temp.users',THIRD),1);
      const erased=await Ledger.enforceAccountDeletion(db,THIRD);
      assert.equal(erased.userDeleted,1);
      assert.equal(await valueForUser(db,'public.users',THIRD),0);
      assert.equal(await valueForUser(db,'pg_temp.users',THIRD),1,
        'account erasure must not touch temporary user shadow');
      assert.equal(Number((await db.query(
        'SELECT count(*)::int AS n FROM public.reazioni'
      )).rows[0].n),0,
      'account deletion must clean reactions by user and linked messages');
      assert.equal(Number((await db.query(
        'SELECT count(*)::int AS n FROM pg_temp.reazioni'
      )).rows[0].n),2,
      'account deletion must preserve temporary reaction shadow');
      assert.equal(Number((await db.query(
        'SELECT count(*)::int AS n FROM public.comunicazioni WHERE id=$1',[ownedComm]
      )).rows[0].n),0);
      const remainingComm=await db.query(
        'SELECT read_by FROM public.comunicazioni WHERE id=$1',[otherComm]
      );
      assert.deepEqual(remainingComm.rows[0].read_by,[],
        'read_by on another user message must drop erased account');
      assert.equal(Number((await db.query(
        'SELECT count(*)::int AS n FROM pg_temp.comunicazioni'
      )).rows[0].n),2);
      assert.equal(await valueForUser(db,'public.users',OTHER),1,
        'other public user must not be deleted');
    } finally {
      // Roll back *all* synthetic mutations, including temporary and newly
      // created public tables. Existing signed replay fixtures stay intact.
      await db.query('ROLLBACK');
    }
    assert.equal(await valueForUser(db,'public.users',THIRD),1,
      'rollback restores public synthetic account and its preferences');
    assert.equal(await valueForUser(db,'public.opinioni_risposte',THIRD),1);
    const events=[
      event(SUBJECT,'political_consent_granted','2026-10-24T12:00:00Z',{original:true}),
      event(SUBJECT,'political_consent_revoked','2026-10-25T12:00:00Z',{reason:'synthetic'}),
      event(OTHER,'political_consent_revoked','2026-10-25T12:00:00Z'),
      event(OTHER,'political_consent_granted','2026-10-26T00:30:00Z')
    ];
    const signed=envelope(events);
    const approved=approvedCheckpoint(signed);
    // No maintenance approval means no query and no changes.
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:signed,secret:SECRET,expectedRecoveryId:RECOVERY,maintenanceConfirmed:false,...approved
    }),/maintenance/);
    assert.equal(await count(db,'political_selections',SUBJECT),1);
    // Signed payload must exactly match approved session and content.
    const tampered=structuredClone(signed);
    tampered.payload.events[1].subject_user_id=THIRD;
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:tampered,secret:SECRET,expectedRecoveryId:RECOVERY,maintenanceConfirmed:true,...approved
    }),/signature invalid/);
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:signed,secret:SECRET,expectedRecoveryId:'wrong_session',maintenanceConfirmed:true,...approved
    }),/session/);
    // The restored DB does not yet have a GDPR ledger. Recovery must reject
    // that snapshot without creating a replacement or deleting user data.
    const noDdlClient = {
      async query(sql, params) {
        assert.doesNotMatch(String(sql), /\bCREATE\s+(?:TABLE|INDEX)\b/i,
          'recovery must not execute implicit schema DDL');
        return db.query(sql, params);
      }
    };
    await assert.rejects(reconcileRestoredPrivacyState({
      client:noDdlClient,envelope:signed,secret:SECRET,
      expectedRecoveryId:RECOVERY,maintenanceConfirmed:true,...approved
    }),/ledger schema missing/);
    assert.equal((await db.query(
      "SELECT to_regclass('public.privacy_erasure_ledger') AS relation"
    )).rows[0].relation,null);
    assert.equal(await count(db,'political_selections',SUBJECT),1);

    // A restored DB may contain an event deliberately omitted from an
    // otherwise correctly signed (and independently pinned) manifest. Never
    // proceed: the omission is a consistency failure, not permission to
    // discard the unknown event.
    await Ledger.ensureTable(db);
    const omitted = event(THIRD,'political_consent_revoked','2026-10-24T14:00:00Z',
      {reason:'synthetic-unapproved-snapshot-event'});
    await db.query(
      'INSERT INTO privacy_erasure_ledger ' +
      '(event_key,subject_user_id,event_type,occurred_at,details) ' +
      'VALUES ($1,$2,$3,$4,$5::jsonb)',
      [omitted.event_key,omitted.subject_user_id,omitted.event_type,
        omitted.occurred_at,JSON.stringify(omitted.details)]
    );
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:signed,secret:SECRET,expectedRecoveryId:RECOVERY,
      maintenanceConfirmed:true,...approved
    }),/absent from approved manifest/);
    assert.equal(Number((await db.query(
      'SELECT count(*)::int AS n FROM privacy_erasure_ledger WHERE event_key=$1',
      [omitted.event_key])).rows[0].n),1);
    assert.equal(await count(db,'political_selections',SUBJECT),1);
    assert.equal(Number((await db.query(
      'SELECT count(*)::int AS n FROM privacy_erasure_ledger'
    )).rows[0].n),1,'failed recovery must not import unapproved ledger');
    // CI-only cleanup of the injected synthetic inconsistent event.
    await db.query('DELETE FROM privacy_erasure_ledger WHERE event_key=$1',
      [omitted.event_key]);

    // Mismatched installation or mode must refuse without any replay.
    process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'true';
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:signed,secret:SECRET,expectedRecoveryId:RECOVERY,
      maintenanceConfirmed:true,...approved
    }),/outbox schema\/mode mismatch/);
    assert.equal(await count(db,'political_selections',SUBJECT),1);
    assert.equal(Number((await db.query(
      'SELECT count(*)::int AS n FROM privacy_erasure_ledger'
    )).rows[0].n),0);
    await Ledger.ensureDeliveryOutbox(db);
    process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'false';
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:signed,secret:SECRET,expectedRecoveryId:RECOVERY,
      maintenanceConfirmed:true,...approved
    }),/outbox schema\/mode mismatch/);
    process.env.GDPR_ERASURE_OUTBOX_ENABLED = 'true';

    // Corrupt-restored-schema fixture: simulate an outbox receipt whose
    // ledger event disappeared. Real FK normally forbids this, but a legacy
    // or damaged restore may lack that guarantee. This is isolated PG17 CI
    // only (guarded by fixed localhost credentials and disposable database).
    const orphanKey = crypto.randomUUID();
    await db.query('SET session_replication_role = replica');
    try {
      await db.query(
        'INSERT INTO privacy_erasure_delivery_outbox(event_key) VALUES ($1)',
        [orphanKey]
      );
    } finally {
      await db.query('SET session_replication_role = origin');
    }
    await assert.rejects(reconcileRestoredPrivacyState({
      client:noDdlClient,envelope:signed,secret:SECRET,expectedRecoveryId:RECOVERY,
      maintenanceConfirmed:true,...approved
    }),/outbox contains orphaned events/);
    assert.equal(await count(db,'political_selections',SUBJECT),1);
    assert.equal(Number((await db.query(
      'SELECT count(*)::int AS n FROM privacy_erasure_ledger'
    )).rows[0].n),0);
    assert.equal(Number((await db.query(
      'SELECT count(*)::int AS n FROM privacy_erasure_delivery_outbox WHERE event_key=$1',
      [orphanKey]
    )).rows[0].n),1,'failed recovery must preserve the inconsistent evidence');
    // CI-only cleanup of the deliberately injected orphan.
    await db.query('DELETE FROM privacy_erasure_delivery_outbox WHERE event_key=$1',[orphanKey]);

    // Disposable PG17: test a non-cooperating writer that owns a ROW
    // EXCLUSIVE table lock WITHOUT our recovery advisory lock. Replay must
    // refuse both cases with 55P03 before any import or privacy cleanup.
    for (const table of ['privacy_erasure_ledger','privacy_erasure_delivery_outbox']) {
      const writer=await pool.connect();
      try {
        await writer.query('BEGIN');
        if (table === 'privacy_erasure_ledger') {
          await writer.query(
            'UPDATE privacy_erasure_ledger SET details=details WHERE event_key=$1',
            [omitted.event_key]
          );
        } else {
          await writer.query(
            'UPDATE privacy_erasure_delivery_outbox ' +
            'SET delivered_at=delivered_at WHERE event_key=$1', [omitted.event_key]
          );
        }
        await assert.rejects(reconcileRestoredPrivacyState({
          client:noDdlClient,envelope:signed,secret:SECRET,
          expectedRecoveryId:RECOVERY,maintenanceConfirmed:true,...approved
        }),error=>error.code==='55P03',
        'replay must reject a concurrent '+table+' writer before state mutation');
        assert.equal(Number((await db.query(
          'SELECT count(*)::int AS n FROM privacy_erasure_ledger'
        )).rows[0].n),0,'failed concurrent replay must not import events');
        assert.equal(await count(db,'political_selections',SUBJECT),1,
          'failed concurrent replay must not erase restored choices');
      } finally {
        await writer.query('ROLLBACK');
        writer.release();
      }
    }
    // The recovery preflight explicitly checks the public schema, but most
    // ledger/outbox statements use unqualified table names. A stale or
    // compromised session search_path must not redirect replay to pg_temp
    // shadow tables, including when those temporary names take precedence.
    // This synthetic fixture is created ONLY in disposable PG17 CI.
    await db.query('CREATE TEMP TABLE privacy_erasure_ledger (event_key text PRIMARY KEY)');
    await db.query('CREATE TEMP TABLE privacy_erasure_delivery_outbox (event_key text PRIMARY KEY)');
    await db.query('SET search_path TO pg_temp, public');
    let first;
    try {
      first=await reconcileRestoredPrivacyState({
        client:noDdlClient,envelope:signed,secret:SECRET,
        expectedRecoveryId:RECOVERY,maintenanceConfirmed:true,...approved
      });
      assert.equal(Number((await db.query(
        'SELECT count(*)::int AS n FROM pg_temp.privacy_erasure_ledger'
      )).rows[0].n),0,'replay must not import into temporary ledger shadow');
      assert.equal(Number((await db.query(
        'SELECT count(*)::int AS n FROM pg_temp.privacy_erasure_delivery_outbox'
      )).rows[0].n),0,'replay must not queue into temporary outbox shadow');
    } finally {
      await db.query('RESET search_path');
      await db.query('DROP TABLE IF EXISTS pg_temp.privacy_erasure_delivery_outbox');
      await db.query('DROP TABLE IF EXISTS pg_temp.privacy_erasure_ledger');
    }
    assert.equal(first.verifiedExternalEvents,4);
    assert.equal(first.imported,4);
    assert.equal(first.revocationsReapplied,1);
    assert.equal(first.staleSnapshotRevocationsReapplied,2);
    assert.equal(first.outboxInserted,4);
    assert.equal(first.pendingExternalReceipts,4);
    assert.equal(Number((await db.query(
      'SELECT count(*)::int AS n FROM privacy_erasure_delivery_outbox'
    )).rows[0].n),4);
    await db.query(
      'UPDATE privacy_erasure_delivery_outbox SET delivered_at=NOW(), ' +
      'b2_version_id=$2, b2_sha256=$3 WHERE event_key=$1',
      [events[0].event_key,'synthetic-locked-version','a'.repeat(64)]
    );
    for (const table of ['political_selections','user_representatives','opinioni_risposte']) {
      assert.equal(await count(db,table,SUBJECT),0);
      // Regrant is newer, but the restored backup predates BOTH the revoke
      // and regrant. Old preferences must be erased, not resurrected.
      assert.equal(await count(db,table,OTHER),0);
    }
    const subjectUser=(await db.query('SELECT nome,ruolo,political_opinions_consent,rappresentante_camera,candidato_comune FROM users WHERE id=$1',[SUBJECT])).rows[0];
    assert.equal(subjectUser.nome,'Subject');
    assert.equal(subjectUser.ruolo,'E');
    assert.equal(subjectUser.political_opinions_consent,false);
    assert.equal(subjectUser.rappresentante_camera,null);
    assert.equal(subjectUser.candidato_comune,null);
    assert.equal((await db.query('SELECT political_opinions_consent FROM users WHERE id=$1',[OTHER])).rows[0].political_opinions_consent,true);

    const repeated=await reconcileRestoredPrivacyState({
      client:noDdlClient,envelope:signed,secret:SECRET,expectedRecoveryId:RECOVERY,maintenanceConfirmed:true,...approved
    });
    assert.equal(repeated.imported,0);
    assert.equal(repeated.outboxInserted,0);
    assert.equal(repeated.pendingExternalReceipts,3);
    const retainedReceipt = (await db.query(
      'SELECT b2_version_id,b2_sha256 FROM privacy_erasure_delivery_outbox ' +
      'WHERE event_key=$1', [events[0].event_key]
    )).rows[0];
    assert.equal(retainedReceipt.b2_version_id,'synthetic-locked-version');
    assert.equal(retainedReceipt.b2_sha256,'a'.repeat(64));

    // A direct ledger replay must also reject contradictory consent events
    // whose timestamps collide at the signed manifest's millisecond precision.
    // In the old ORDER BY occurred_at DESC, event_key DESC, random UUID
    // ordering could have selected an unsafe consent grant.
    const tiedRevoke = event(THIRD,'political_consent_revoked',
      '2026-10-25T14:00:00.000000Z');
    const tiedGrant = event(THIRD,'political_consent_granted',
      '2026-10-25T14:00:00.000500Z');
    for (const entry of [tiedRevoke,tiedGrant]) {
      await db.query(
        'INSERT INTO privacy_erasure_ledger ' +
        '(event_key,subject_user_id,event_type,occurred_at,details) ' +
        'VALUES ($1,$2,$3,$4,$5::jsonb)',
        [entry.event_key,entry.subject_user_id,entry.event_type,
          entry.occurred_at,JSON.stringify(entry.details)]
      );
    }
    await assert.rejects(Ledger.applyCurrentPrivacyState(db),
      /Ambiguous simultaneous GDPR consent/);
    assert.equal(await count(db,'political_selections',THIRD),1);
    assert.equal(await count(db,'political_selections',SUBJECT),0);
    await db.query(
      'DELETE FROM privacy_erasure_ledger WHERE event_key = ANY($1::text[])',
      [[tiedRevoke.event_key,tiedGrant.event_key]]
    );

    // Even a *validly signed* manifest cannot silently rewrite an event
    // that already exists with the same key and a different subject/type.
    const conflictingEvents=structuredClone(events);
    conflictingEvents[0].details={changed:true};
    const conflictEnvelope=envelope(conflictingEvents);
    const conflictApproved=approvedCheckpoint(conflictEnvelope);
    await assert.rejects(reconcileRestoredPrivacyState({
      client:db,envelope:conflictEnvelope,secret:SECRET,
      expectedRecoveryId:RECOVERY,maintenanceConfirmed:true,...conflictApproved
    }),/conflicts with signed/);

    // A failure after ledger import must rollback the import AND any
    // performed deletions. The operator cannot reopen until retry succeeds.
    const thirdEvent=event(THIRD,'political_consent_revoked','2026-10-25T12:00:00Z');
    const thirdEnvelope=envelope([...events,thirdEvent]);
    const thirdApproved=approvedCheckpoint(thirdEnvelope);
    const injected={
      async query(sql,params) {
        if (String(sql).startsWith('DELETE FROM public."political_selections"')) {
          throw Error('synthetic recovery write failure');
        }
        return db.query(sql,params);
      }
    };
    await assert.rejects(reconcileRestoredPrivacyState({
      client:injected,envelope:thirdEnvelope,secret:SECRET,
      expectedRecoveryId:RECOVERY,maintenanceConfirmed:true,...thirdApproved
    }),/synthetic recovery write failure/);
    assert.equal(await count(db,'political_selections',THIRD),1);
    assert.equal(Number((await db.query('SELECT count(*)::int AS n FROM privacy_erasure_ledger WHERE event_key=$1',[thirdEvent.event_key])).rows[0].n),0);
    const recovered=await reconcileRestoredPrivacyState({
      client:noDdlClient,envelope:thirdEnvelope,secret:SECRET,
      expectedRecoveryId:RECOVERY,maintenanceConfirmed:true,...thirdApproved
    });
    assert.equal(recovered.imported,1);
    assert.equal(recovered.outboxInserted,1);
    assert.equal(recovered.pendingExternalReceipts,4);
    assert.equal(await count(db,'political_selections',THIRD),0);
    console.log('PRIVACY_RECOVERY_GATE_PG17_PASS '+JSON.stringify({
      synthetic:true,externalHmacVerified:true,revokeAfterBackup:true,
      regrantDoesNotResurrectOldChoices:true,otherUserDataPreserved:true,idempotent:true,
      replayFailureRolledBack:true,maintenanceRequired:true,
      unapprovedRestoredEventRejected:true,
      outboxSchemaMismatchRejected:true,restoredEventsQueuedAtomically:true,
      deliveryReceiptPreserved:true,simultaneousConsentTieRejected:true,
      missingLedgerRejectedWithoutDdl:true,recoveryReplayZeroDdl:true,
      cleanupPublicSchemaShadowPg17:true,productionUntouched:true
    }));
  } catch(error) {
    await db.query('ROLLBACK').catch(()=>{});
    throw error;
  } finally {
    db.release();await pool.end();
  }
}
main().catch(err=>{console.error('PRIVACY_RECOVERY_GATE_PG17_FAIL',err);process.exitCode=1;});
