'use strict';

/**
 * DOC-050, CI-only: independent PG17 journal service + destructive loss of
 * a separate *synthetic* primary DB + authentic older pg_dump restore.
 *
 * Security contract tested: journal HMAC chain, missing/tampered/outage
 * refusal, gap detection, restore fencing, and a restricted SQL reader
 * role that cannot SELECT the underlying BYTEA table before reconciliation.
 *
 * NOT imported from DEMOS routes. NOT a Supabase/offsite deployment design.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');
const { createCatalogRegistry, encodeEnvelope, decodeEnvelope } =
  require('../utils/opinionCodecEnvelope');
const { catalogFingerprint } = require('../utils/opinionBitset');
const ENV_DB = 'opinion_bitset_ci';
const SOURCE_DB = 'opinion_remote_source_ci';
const RESTORED_DB = 'opinion_remote_restored_ci';
const JOURNAL_DB = 'opinion_remote_journal_ci';
const READER = 'ci_remote_reader_050';
const HMAC_KEY = 'ci-only-not-secret-no-production-use-doc050';
const SEED = '0'.repeat(64);
const JPORT = 55432;
const SUBJECTS = ['synthetic_erased_a', 'synthetic_retained_b',
  'synthetic_erased_c', 'synthetic_late_d'];
const IDS_V1 = ['synthetic_alpha', 'synthetic_beta'];
const IDS_V2 = [...IDS_V1, 'synthetic_gamma'];
const TABLES = {
  catalog: 'ci_remote_catalog',
  subjects: 'ci_remote_subjects',
  votes: 'ci_remote_votes',
  requests: 'ci_remote_requests',
  gate: 'ci_remote_gate',
  journal: 'ci_remote_events',
  head: 'ci_remote_event_head'
};
function guard() {
  const e = process.env;
  if (e.GITHUB_ACTIONS !== 'true' ||
      e.OPINION_BENCH_EPHEMERAL !== 'yes' ||
      e.PGHOST !== '127.0.0.1' || e.PGPORT !== '5432' ||
      e.PGDATABASE !== ENV_DB || e.PGUSER !== 'postgres' ||
      e.PGPASSWORD !== 'synthetic-only' ||
      e.OPINION_REMOTE_JOURNAL !== 'synthetic-journal-only' ||
      !['seed', 'revoke', 'verify'].includes(e.OPINION_REMOTE_PHASE)) {
    throw Error('Refusing two-database journal probe outside disposable CI');
  }
}
async function connect(database, port, app) {
  const c = new Client({
    host: '127.0.0.1', port, database,
    user: 'postgres', password: 'synthetic-only',
    application_name: app, statement_timeout: 15000
  });
  await c.connect();
  return c;
}
async function checkDb(db, name) {
  const row = (await db.query('SELECT current_database() db,current_user actor,' +
    "current_setting('server_version_num')::integer ver")).rows[0];
  assert.equal(row.db, name);
  assert.equal(row.actor, 'postgres');
  assert.equal(Math.floor(row.ver / 10000), 17);
}
function mac(sequence, subject, epoch, prev) {
  return crypto.createHmac('sha256', HMAC_KEY)
    .update(JSON.stringify([sequence,subject,epoch,prev])).digest('hex');
}
async function createFixtures(db, remote) {
  await db.query('CREATE TABLE ' + TABLES.catalog + ' (' +
    'version integer PRIMARY KEY, ordered_ids jsonb NOT NULL,' +
    'fingerprint text NOT NULL)');
  await db.query('CREATE TABLE ' + TABLES.subjects + ' (' +
    'subject text PRIMARY KEY, granted boolean NOT NULL,' +
    'epoch integer NOT NULL CHECK(epoch > 0))');
  await db.query('CREATE TABLE ' + TABLES.votes + ' (' +
    'subject text PRIMARY KEY REFERENCES ' + TABLES.subjects + '(subject),' +
    'catalog_version integer NOT NULL REFERENCES ' + TABLES.catalog +
    '(version),catalog_fingerprint text NOT NULL,' +
    'encoding text NOT NULL,payload bytea NOT NULL,revision int NOT NULL)');
  await db.query('CREATE TABLE ' + TABLES.requests + ' (' +
    'subject text NOT NULL REFERENCES ' + TABLES.subjects + '(subject),' +
    'request_id text NOT NULL,epoch integer NOT NULL,revision int NOT NULL,' +
    'PRIMARY KEY(subject,request_id))');
  await db.query('CREATE TABLE ' + TABLES.gate + ' (' +
    'singleton boolean PRIMARY KEY CHECK(singleton),' +
    'sealed boolean NOT NULL,last_seq bigint NOT NULL DEFAULT 0)');
  await db.query('INSERT INTO ' + TABLES.gate +
    ' (singleton,sealed,last_seq) VALUES(true,true,0)');
  const ids = [IDS_V1, IDS_V2];
  for (let i = 0; i < 2; i++) {
    await db.query('INSERT INTO ' + TABLES.catalog +
      ' (version,ordered_ids,fingerprint) VALUES($1,$2::jsonb,$3)',
      [i+1,JSON.stringify(ids[i]),catalogFingerprint(ids[i])]);
  }
  const registry = createCatalogRegistry([
    {version:1,ids:IDS_V1},{version:2,ids:IDS_V2}
  ]);
  for (const [i,subject] of SUBJECTS.entries()) {
    const version = i % 2 === 0 ? 1 : 2;
    const answers = i % 2 === 0 ?
      {synthetic_alpha:'f'} :
      {synthetic_alpha:'c',synthetic_gamma:'i'};
    const env = encodeEnvelope(registry,{
      version,encoding:'sparse',answers
    });
    await db.query('INSERT INTO ' + TABLES.subjects +
      ' (subject,granted,epoch) VALUES($1,true,1)',[subject]);
    await db.query('INSERT INTO ' + TABLES.votes +
      ' (subject,catalog_version,catalog_fingerprint,encoding,payload,revision)' +
      ' VALUES($1,$2,$3,$4,$5,1)',[
        subject,env.catalogVersion,env.catalogFingerprint,
        env.encoding,env.payload
      ]);
    await db.query('INSERT INTO ' + TABLES.requests +
      ' (subject,request_id,epoch,revision) VALUES($1,$2,1,1)',[
        subject,'old-request-'+i
      ]);
  }
  await remote.query('CREATE TABLE ' + TABLES.head + ' (' +
    'singleton boolean PRIMARY KEY CHECK(singleton),' +
    'last_seq bigint NOT NULL,last_mac text NOT NULL)');
  await remote.query('CREATE TABLE ' + TABLES.journal + ' (' +
    'seq bigint PRIMARY KEY,subject text NOT NULL,' +
    'epoch int NOT NULL,prev_mac text NOT NULL,mac text NOT NULL)');
  await remote.query('INSERT INTO ' + TABLES.head +
    ' (singleton,last_seq,last_mac) VALUES(true,0,$1)',[SEED]);
  console.log('OPINION_REMOTE_JOURNAL_PREBACKUP_SEEDED');
}
async function appendJournal(remote,subject,epoch) {
  await remote.query('BEGIN');
  try {
    const current=(await remote.query('SELECT last_seq,last_mac FROM ' +
      TABLES.head + ' WHERE singleton=true FOR UPDATE')).rows[0];
    const seq=Number(current.last_seq)+1;
    const digest=mac(seq,subject,epoch,current.last_mac);
    await remote.query('INSERT INTO '+TABLES.journal+
      ' (seq,subject,epoch,prev_mac,mac) VALUES($1,$2,$3,$4,$5)',
      [seq,subject,epoch,current.last_mac,digest]);
    await remote.query('UPDATE '+TABLES.head+
      ' SET last_seq=$1,last_mac=$2 WHERE singleton=true',[seq,digest]);
    await remote.query('COMMIT');
    return seq;
  } catch(e) {
    await remote.query('ROLLBACK');
    throw e;
  }
}
async function revoke(source, remote) {
  for (const subject of [SUBJECTS[0],SUBJECTS[2]]) {
    // Durably record the erasure event on the independent container FIRST.
    // If the primary is lost after this commit, the event still exists.
    const seq=await appendJournal(remote,subject,2);
    await source.query('BEGIN');
    try {
      const target=(await source.query('SELECT granted,epoch FROM ' +
        TABLES.subjects + ' WHERE subject=$1 FOR UPDATE',[subject])).rows[0];
      assert.equal(target.granted,true);
      assert.equal(target.epoch,1);
      await source.query('UPDATE '+TABLES.subjects+
        ' SET granted=false,epoch=2 WHERE subject=$1',[subject]);
      await source.query('DELETE FROM '+TABLES.requests+
        ' WHERE subject=$1',[subject]);
      await source.query('DELETE FROM '+TABLES.votes+
        ' WHERE subject=$1',[subject]);
      await source.query('COMMIT');
      assert.ok(seq>0);
    }catch(e){await source.query('ROLLBACK');throw e;}
  }
  const count=(await source.query('SELECT count(*)::integer n FROM ' +
    TABLES.votes)).rows[0].n;
  assert.equal(count,2);
  const remoteHead=(await remote.query('SELECT last_seq FROM '+TABLES.head+
    ' WHERE singleton=true')).rows[0].last_seq;
  assert.equal(Number(remoteHead),2);
  console.log('OPINION_REMOTE_JOURNAL_REVOCATIONS_COMMITTED');
}
async function snapshot(db,subject) {
  const c=(await db.query('SELECT granted,epoch FROM '+TABLES.subjects+
    ' WHERE subject=$1',[subject])).rows[0];
  const vote=(await db.query('SELECT * FROM '+TABLES.votes+
    ' WHERE subject=$1',[subject])).rows[0]||null;
  const requests=(await db.query('SELECT * FROM '+TABLES.requests+
    ' WHERE subject=$1 ORDER BY request_id',[subject])).rows;
  return {consent:c,vote,requests};
}
async function sealed(db) {
  const row=(await db.query('SELECT sealed,last_seq FROM '+TABLES.gate+
    ' WHERE singleton=true')).rows[0];
  assert.ok(row);
  return {sealed:row.sealed,seq:Number(row.last_seq)};
}
async function authenticatedRemoteSnapshot(remote) {
  const head=(await remote.query('SELECT last_seq,last_mac FROM ' +
    TABLES.head+' WHERE singleton=true')).rows[0];
  assert.ok(head,'Journal head unavailable');
  const events=(await remote.query('SELECT seq,subject,epoch,prev_mac,mac'+
    ' FROM '+TABLES.journal+' ORDER BY seq')).rows;
  let seq=0,previous=SEED;
  for(const e of events) {
    seq++;
    assert.equal(Number(e.seq),seq,'REMOTE_JOURNAL_GAP');
    assert.equal(e.prev_mac,previous,'REMOTE_JOURNAL_PREV_MAC_INVALID');
    const expected=mac(seq,e.subject,e.epoch,previous);
    assert.equal(e.mac,expected,'REMOTE_JOURNAL_HMAC_INVALID');
    assert.ok(SUBJECTS.includes(e.subject),'Invalid journal subject');
    assert.equal(e.epoch,2,'Unexpected consent generation');
    previous=e.mac;
  }
  assert.equal(Number(head.last_seq),seq,'REMOTE_JOURNAL_HEAD_MISMATCH');
  assert.equal(head.last_mac,previous,'REMOTE_JOURNAL_HEAD_MAC_INVALID');
  assert.ok(seq>=2);
  return {seq,mac:previous,events};
}
async function makeProtectedRole(db) {
  // Restricted demo reader: only this view, not the raw BYTEA table.
  // Existing PostgreSQL connections as superuser are NOT restricted.
  await db.query('CREATE ROLE '+READER+' NOLOGIN');
  await db.query('GRANT USAGE ON SCHEMA public TO '+READER);
  await db.query('CREATE VIEW ci_remote_readable WITH (security_barrier=true) AS ' +
    'SELECT v.subject,v.payload FROM '+TABLES.votes+' v ' +
    'JOIN '+TABLES.subjects+' s ON s.subject=v.subject '+
    'WHERE s.granted=true AND EXISTS (SELECT 1 FROM '+TABLES.gate+
    ' g WHERE g.singleton=true AND g.sealed=false)');
  await db.query('GRANT SELECT ON ci_remote_readable TO '+READER);
}
async function viewRows(db) {
  await db.query('SET ROLE '+READER);
  try {
    const current=(await db.query('SELECT current_user as actor')).rows[0].actor;
    assert.equal(current,READER);
    await assert.rejects(db.query('SELECT * FROM '+TABLES.votes),
      /permission denied/i);
    return (await db.query('SELECT subject,payload FROM ci_remote_readable'+
      ' ORDER BY subject')).rows;
  } finally {
    await db.query('RESET ROLE');
  }
}
async function reconcile(db,remote,opts={}) {
  if(opts.unavailable) throw Error('REMOTE_JOURNAL_UNAVAILABLE');
  const journal=await authenticatedRemoteSnapshot(remote);
  await db.query('BEGIN');
  try {
    const before=(await db.query('SELECT sealed,last_seq FROM '+
      TABLES.gate+' WHERE singleton=true FOR UPDATE')).rows[0];
    assert.ok(before);
    let applied=Number(before.last_seq);
    if(!before.sealed && applied<journal.seq) {
      throw Error('RESTORE_ALREADY_OPEN_AND_STALE');
    }
    for(const e of journal.events) {
      const seq=Number(e.seq);
      if(seq<=applied) continue;
      assert.equal(seq,applied+1);
      const updated=await db.query('UPDATE '+TABLES.subjects+
        ' SET granted=false,epoch=GREATEST(epoch,$2)'+
        ' WHERE subject=$1 RETURNING subject',[e.subject,e.epoch]);
      assert.equal(updated.rowCount,1,'Journal subject missing from restore');
      await db.query('DELETE FROM '+TABLES.votes+
        ' WHERE subject=$1',[e.subject]);
      await db.query('DELETE FROM '+TABLES.requests+
        ' WHERE subject=$1',[e.subject]);
      applied=seq;
    }
    if(opts.injectFailure) throw Error('INJECTED_RECONCILIATION_FAILURE');
    if(opts.appendConcurrentEvent) {
      assert.equal(journal.seq,2);
      await appendJournal(remote,SUBJECTS[3],2);
    }
    // Fence against an event appended AFTER our first journal snapshot.
    const again=await authenticatedRemoteSnapshot(remote);
    assert.equal(again.seq,journal.seq,'REMOTE_JOURNAL_ADVANCED_DURING_RESTORE');
    assert.equal(again.mac,journal.mac,'REMOTE_JOURNAL_CHANGED_DURING_RESTORE');
    await db.query('UPDATE '+TABLES.gate+
      ' SET sealed=false,last_seq=$1 WHERE singleton=true',[applied]);
    await db.query('COMMIT');
    return applied;
  }catch(e){await db.query('ROLLBACK');throw e;}
}
async function verify(restore,remote,admin) {
  // Destructively dropped only the dedicated synthetic source database.
  const sourceExists=(await admin.query('SELECT 1 FROM pg_database'+
    ' WHERE datname=$1',[SOURCE_DB])).rowCount;
  assert.equal(sourceExists,0,'Dedicated source DB must be destroyed');
  const origErased=await snapshot(restore,SUBJECTS[0]);
  assert.equal(origErased.consent.granted,true);
  assert.ok(Buffer.isBuffer(origErased.vote.payload));
  assert.equal(origErased.requests.length,1);
  const untouched=await snapshot(restore,SUBJECTS[1]);
  assert.equal((await sealed(restore)).sealed,true);
  await makeProtectedRole(restore);
  assert.deepEqual(await viewRows(restore),[]);
  await assert.rejects(reconcile(restore,remote,{unavailable:true}),
    /REMOTE_JOURNAL_UNAVAILABLE/);
  assert.equal((await sealed(restore)).sealed,true);

  // Tamper content without possession of HMAC key: reject, remain sealed.
  await remote.query('BEGIN');
  try {
    await remote.query('UPDATE '+TABLES.journal+
      ' SET subject=$1 WHERE seq=1',[SUBJECTS[1]]);
    await assert.rejects(reconcile(restore,remote),/REMOTE_JOURNAL_HMAC_INVALID/);
  } finally {await remote.query('ROLLBACK');}
  assert.deepEqual(await snapshot(restore,SUBJECTS[0]),origErased);

  // Remove tail event but leave journal head intact: reject incomplete log.
  await remote.query('BEGIN');
  try {
    await remote.query('DELETE FROM '+TABLES.journal+' WHERE seq=2');
    await assert.rejects(reconcile(restore,remote),/REMOTE_JOURNAL_HEAD_MISMATCH/);
  } finally {await remote.query('ROLLBACK');}
  assert.equal((await sealed(restore)).sealed,true);

  await assert.rejects(reconcile(restore,remote,{injectFailure:true}),
    /INJECTED_RECONCILIATION_FAILURE/);
  assert.deepEqual(await snapshot(restore,SUBJECTS[0]),origErased);
  assert.deepEqual(await viewRows(restore),[]);

  // A new remote erasure is committed *while* reconciliation is running.
  // Without the second head check this would open stale restored data.
  await assert.rejects(reconcile(restore,remote,{appendConcurrentEvent:true}),
    /REMOTE_JOURNAL_ADVANCED_DURING_RESTORE/);
  assert.deepEqual(await snapshot(restore,SUBJECTS[0]),origErased);
  assert.equal((await sealed(restore)).sealed,true);
  assert.equal((await authenticatedRemoteSnapshot(remote)).seq,3);

  assert.equal(await reconcile(restore,remote),3);
  assert.deepEqual(await sealed(restore),{sealed:false,seq:3});
  for(const erased of [SUBJECTS[0],SUBJECTS[2],SUBJECTS[3]]) {
    const s=await snapshot(restore,erased);
    assert.equal(s.consent.granted,false);
    assert.equal(s.consent.epoch,2);
    assert.equal(s.vote,null);
    assert.equal(s.requests.length,0);
  }
  assert.deepEqual(await snapshot(restore,SUBJECTS[1]),untouched);
  const permitted=await viewRows(restore);
  assert.deepEqual(permitted.map(r=>r.subject),[SUBJECTS[1]]);
  const catalog=(await restore.query('SELECT version,ordered_ids FROM '+
    TABLES.catalog+' ORDER BY version')).rows;
  const registry=createCatalogRegistry(catalog.map(x=>({
    version:x.version,ids:x.ordered_ids
  })));
  const row=untouched.vote;
  const answers=decodeEnvelope(registry,{
    schemaVersion:1,catalogVersion:row.catalog_version,
    catalogFingerprint:row.catalog_fingerprint,
    encoding:row.encoding,payload:row.payload
  });
  assert.equal(answers.synthetic_alpha,'c');
  assert.equal(answers.synthetic_gamma,'i');
  assert.equal(await reconcile(restore,remote),3);
  assert.deepEqual(await sealed(restore),{sealed:false,seq:3});
  console.log('OPINION_REMOTE_JOURNAL_RESTORE_PASS');
  console.log('OPINION_REMOTE_JOURNAL_RESTORE_RESULT_JSON='+JSON.stringify({
    postgres:17,synthetic:true,
    independentPG17ContainerForJournal:true,
    sourceDatabaseDestroyedBeforeRestore:true,
    verifiedHmacSequenceEvents:3,
    preRevocationBYTEAResurrectedThenErased:true,
    replayLedgerPurged:true,
    restrictedReaderCannotSelectRawBYTEA:true,
    restrictedViewClosedUntilReconciliation:true,
    journalOutageAndTamperAndTailGapFailClosed:true,
    injectedTransactionRollbackPreservesSealed:true,
    concurrentJournalAdvanceFenced:true,
    preservedUnrevokedAnswerAndCatalogV2:true,
    replayIdempotent:true,
    limitations:[
      'Journal and source are distinct PG17 processes/containers on the same ephemeral GitHub Actions host, not separate physical sites or enduring offsite storage.',
      'This HMAC chain uses a public dummy CI key; no production key management, external anchor or protection from administrators rewriting the entire log.',
      'No two-phase commit: journal-first events can deny data even if primary revocation never commits; source admission must be designed separately.',
      'A check-then-commit fence is NOT sufficient against a journal append immediately after the second read; a production solution requires a durable commit barrier and coordinated serving cutover.',
      'Restricted view protects only this one role/path, not all actual DEMOS APIs, privileges, replicas or Supabase RLS.',
      'No real users, Android, JWT, consent API, Supabase, GDPR compliance or deployment is tested.'
    ]
  }));
}
async function main() {
  guard();
  const phase=process.env.OPINION_REMOTE_PHASE;
  const remote=await connect(JOURNAL_DB,JPORT,'ci_050_remote_'+phase);
  let primary,admin;
  try {
    await checkDb(remote,JOURNAL_DB);
    if(phase==='seed'||phase==='revoke') {
      primary=await connect(SOURCE_DB,5432,'ci_050_source_'+phase);
      await checkDb(primary,SOURCE_DB);
    }
    if(phase==='seed') await createFixtures(primary,remote);
    if(phase==='revoke') await revoke(primary,remote);
    if(phase==='verify') {
      primary=await connect(RESTORED_DB,5432,'ci_050_restored');
      admin=await connect(ENV_DB,5432,'ci_050_catalog');
      await checkDb(primary,RESTORED_DB);
      await verify(primary,remote,admin);
    }
  }finally{
    await Promise.allSettled([primary?.end(),admin?.end(),remote.end()]);
  }
}
main().catch(e=>{
  console.error('Independent journal restore probe FAILED:',e);
  process.exitCode=1;
});
