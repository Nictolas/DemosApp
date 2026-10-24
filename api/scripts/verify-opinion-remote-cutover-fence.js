'use strict';

/**
 * DOC-051 CI-only follow-on to DOC-050.
 * Demonstrates TOCTOU leak without coordination, and an explicit
 * remote-head row lock held for the duration of every demo read and
 * every restore/reconciliation cutover. Two separate PG17 processes.
 *
 * Not DEMOS middleware, not Supabase, not distributed transaction.
 */
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Client } = require('pg');

const JOURNAL='opinion_remote_journal_ci';
const TARGET='opinion_remote_restored_ci';
const READER='ci_remote_reader_050';
const HEAD='ci_remote_event_head';
const EVENTS='ci_remote_events';
const GATE='ci_remote_gate';
const SUBJECTS='ci_remote_subjects';
const VOTES='ci_remote_votes';
const REQUESTS='ci_remote_requests';
const VIEW='ci_remote_readable';
const ALL=['synthetic_erased_a','synthetic_retained_b','synthetic_erased_c','synthetic_late_d'];
const DUMMY_KEY='ci-only-not-secret-no-production-use-doc050';
const SEED='0'.repeat(64);

function guard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.OPINION_BENCH_EPHEMERAL!=='yes'||
     e.PGHOST!=='127.0.0.1'||e.PGPORT!=='5432'||
     e.PGDATABASE!=='opinion_bitset_ci'||
     e.PGUSER!=='postgres'||e.PGPASSWORD!=='synthetic-only'||
     e.OPINION_REMOTE_JOURNAL!=='synthetic-journal-only'||
     e.OPINION_REMOTE_CUTOVER!=='synthetic-fence-only'){
    throw Error('Refusing coordinated cutover test outside disposable CI');
  }
}
async function connect(db,port,app){
  const c=new Client({host:'127.0.0.1',port,database:db,
    user:'postgres',password:'synthetic-only',application_name:app,
    statement_timeout:12000});
  await c.connect();
  return c;
}
function digest(seq,subject,epoch,prev){
  return crypto.createHmac('sha256',DUMMY_KEY)
    .update(JSON.stringify([seq,subject,epoch,prev])).digest('hex');
}
async function current(db,locked=false){
  const h=(await db.query('SELECT last_seq,last_mac FROM '+HEAD+
    ' WHERE singleton=true'+(locked?' FOR SHARE':''))).rows[0];
  assert.ok(h);
  return {seq:Number(h.last_seq),mac:h.last_mac};
}
async function eventsVerified(db,head){
  const items=(await db.query('SELECT seq,subject,epoch,prev_mac,mac FROM '+
    EVENTS+' ORDER BY seq')).rows;
  let previous=SEED,seq=0;
  for(const event of items){
    seq++;
    assert.equal(Number(event.seq),seq,'JOURNAL_SEQUENCE_GAP');
    assert.ok(ALL.includes(event.subject),'UNKNOWN_JOURNAL_SUBJECT');
    assert.equal(event.epoch,2,'BAD_EPOCH');
    assert.equal(event.prev_mac,previous,'BAD_PREV_MAC');
    assert.equal(event.mac,digest(seq,event.subject,event.epoch,previous),
      'BAD_JOURNAL_MAC');
    previous=event.mac;
  }
  assert.equal(seq,head.seq,'JOURNAL_HEAD_SEQUENCE_MISMATCH');
  assert.equal(previous,head.mac,'JOURNAL_HEAD_MAC_MISMATCH');
  return items;
}
async function gate(db){
  const row=(await db.query('SELECT sealed,last_seq FROM '+GATE+
    ' WHERE singleton=true')).rows[0];
  assert.ok(row);
  return {sealed:row.sealed,seq:Number(row.last_seq)};
}
async function append(writer,subject){
  assert.ok(ALL.includes(subject));
  await writer.query('BEGIN');
  try{
    const before=(await writer.query('SELECT last_seq,last_mac FROM '+HEAD+
      ' WHERE singleton=true FOR UPDATE')).rows[0];
    const seq=Number(before.last_seq)+1;
    const mac=digest(seq,subject,2,before.last_mac);
    await writer.query('INSERT INTO '+EVENTS+
      ' (seq,subject,epoch,prev_mac,mac) VALUES($1,$2,2,$3,$4)',
      [seq,subject,before.last_mac,mac]);
    await writer.query('UPDATE '+HEAD+
      ' SET last_seq=$1,last_mac=$2 WHERE singleton=true',[seq,mac]);
    await writer.query('COMMIT');
    return seq;
  }catch(e){
    await writer.query('ROLLBACK');
    throw e;
  }
}
async function pid(db){
  return (await db.query('SELECT pg_backend_pid() pid')).rows[0].pid;
}
async function blocked(observer,waiter,holder,label){
  for(let n=0;n<330;n++){
    const row=(await observer.query(
      'SELECT pg_blocking_pids($1::integer) blockers',[waiter])).rows[0];
    if(row.blockers.includes(holder)) return;
    await new Promise(r=>setTimeout(r,12));
  }
  throw Error('Did not observe PG17 lock contention: '+label);
}
// Only this demo read path is protected. No raw DB access from callers.
async function secureRead(remote,target,opts={}){
  if(opts.unavailable) throw Error('REMOTE_JOURNAL_UNAVAILABLE');
  await remote.query('BEGIN');
  try{
    const head=await current(remote,true);
    await eventsVerified(remote,head);
    const status=await gate(target);
    if(status.sealed||status.seq!==head.seq){
      throw Error('RESTORE_NOT_RECONCILED');
    }
    if(opts.pause) await opts.pause();
    await target.query('SET ROLE '+READER);
    try{
      const role=(await target.query('SELECT current_user actor')).rows[0].actor;
      assert.equal(role,READER);
      await assert.rejects(target.query('SELECT subject FROM '+VOTES),
        /permission denied/i);
      const rows=(await target.query('SELECT subject,payload FROM '+VIEW+
        ' ORDER BY subject')).rows;
      return rows;
    }finally{await target.query('RESET ROLE');}
  }finally{
    // Remote shared row lock is held until AFTER the target result
    // is read; a journal writer cannot commit while this read is active.
    await remote.query('ROLLBACK');
  }
}
// Reconcile holds the REMOTE head SHARE lock through TARGET COMMIT.
// Writer requires UPDATE on same head row and must wait for release.
async function reconcile(remote,target,opts={}){
  await remote.query('BEGIN');
  let targetTx=false;
  try{
    const head=await current(remote,true);
    const items=await eventsVerified(remote,head);
    await target.query('BEGIN');
    targetTx=true;
    const g=(await target.query('SELECT sealed,last_seq FROM '+GATE+
      ' WHERE singleton=true FOR UPDATE')).rows[0];
    assert.ok(g);
    let applied=Number(g.last_seq);
    if(applied>head.seq) throw Error('LOCAL_AHEAD_OF_REMOTE');
    for(const item of items){
      const seq=Number(item.seq);
      if(seq<=applied)continue;
      assert.equal(seq,applied+1);
      const subject=await target.query('UPDATE '+SUBJECTS+
        ' SET granted=false,epoch=GREATEST(epoch,$2) WHERE subject=$1'+
        ' RETURNING subject',[item.subject,item.epoch]);
      assert.equal(subject.rowCount,1);
      await target.query('DELETE FROM '+VOTES+' WHERE subject=$1',
        [item.subject]);
      await target.query('DELETE FROM '+REQUESTS+' WHERE subject=$1',
        [item.subject]);
      applied=seq;
    }
    if(opts.afterDeletes) await opts.afterDeletes();
    await target.query('UPDATE '+GATE+
      ' SET sealed=false,last_seq=$1 WHERE singleton=true',[applied]);
    await target.query('COMMIT');
    targetTx=false;
    if(opts.afterLocalCommit) await opts.afterLocalCommit();
    return applied;
  }catch(e){
    if(targetTx)await target.query('ROLLBACK');
    throw e;
  }finally{
    await remote.query('ROLLBACK');
  }
}
async function main(){
  guard();
  const remoteReader=await connect(JOURNAL,55432,'ci_051_remote_reader');
  let remoteWriter,remoteGate,remoteObserver,targetReader,targetWrite;
  let pending=null,holdCount=0;
  try{
    remoteWriter=await connect(JOURNAL,55432,'ci_051_writer');
    remoteGate=await connect(JOURNAL,55432,'ci_051_cutover');
    remoteObserver=await connect(JOURNAL,55432,'ci_051_observer');
    targetReader=await connect(TARGET,5432,'ci_051_view');
    targetWrite=await connect(TARGET,5432,'ci_051_reconcile');
    const observerPid=await pid(remoteReader);
    const writerPid=await pid(remoteWriter);
    const gatePid=await pid(remoteGate);
    const begin=await current(remoteReader);
    assert.equal(begin.seq,3);
    assert.deepEqual(await gate(targetReader),{sealed:false,seq:3});

    // Safety while a user is READING: commit of a new remote revoke
    // cannot occur between checking head and fetching BYTEA.
    const rows=await secureRead(remoteReader,targetReader,{
      pause:async()=>{
        pending=append(remoteWriter,ALL[1]);
        await blocked(remoteObserver,writerPid,observerPid,
          'writer held behind admitted read');
        holdCount++;
      }
    });
    assert.deepEqual(rows.map(x=>x.subject),[ALL[1]]);
    assert.equal(await pending,4);
    // Writer committed immediately after prior permitted read completed.
    assert.equal((await gate(targetReader)).seq,3);
    await assert.rejects(secureRead(remoteReader,targetReader),
      /RESTORE_NOT_RECONCILED/);
    await assert.rejects(secureRead(remoteReader,targetReader,{
      unavailable:true}),/REMOTE_JOURNAL_UNAVAILABLE/);

    // Safety during cutover: journal writer must block until the target
    // erasure and gate watermark have COMMITTED under remote head lock.
    let gateWriter;
    const applied=await reconcile(remoteGate,targetWrite,{
      afterDeletes:async()=>{
        gateWriter=append(remoteWriter,ALL[0]);
        await blocked(remoteObserver,writerPid,gatePid,
          'writer held behind cross-db cutover');
        holdCount++;
      },
      afterLocalCommit:async()=>{
        const local=await gate(targetReader);
        assert.deepEqual(local,{sealed:false,seq:4});
        // Remote head still version 4; subsequent writer cannot commit
        // until after this callback and release of FOR SHARE.
        assert.equal((await current(remoteObserver)).seq,4);
        const available=await secureRead(remoteReader,targetReader);
        assert.deepEqual(available,[],'Erased subject B visible at cutover');
      }
    });
    assert.equal(applied,4);
    assert.equal(await gateWriter,5);
    await assert.rejects(secureRead(remoteReader,targetReader),
      /RESTORE_NOT_RECONCILED/);
    assert.equal(await reconcile(remoteGate,targetWrite),5);
    assert.deepEqual(await gate(targetReader),{sealed:false,seq:5});
    assert.deepEqual(await secureRead(remoteReader,targetReader),[]);
    assert.equal(await reconcile(remoteGate,targetWrite),5);
    for(const subject of ALL){
      const state=(await targetWrite.query(
        'SELECT granted,epoch FROM '+SUBJECTS+' WHERE subject=$1',
        [subject])).rows[0];
      assert.equal(state.granted,false);
      assert.equal(state.epoch,2);
      assert.equal((await targetWrite.query('SELECT 1 FROM '+VOTES+
        ' WHERE subject=$1',[subject])).rowCount,0);
      assert.equal((await targetWrite.query('SELECT 1 FROM '+REQUESTS+
        ' WHERE subject=$1',[subject])).rowCount,0);
    }
    assert.equal((await current(remoteObserver)).seq,5);
    assert.equal(holdCount,2);
    console.log('OPINION_REMOTE_CUTOVER_FENCE_PASS');
    console.log('OPINION_REMOTE_CUTOVER_RESULT_JSON='+JSON.stringify({
      postgres:17,synthetic:true,
      independentJournalProcess:true,verifiedJournalEvents:5,
      observedWriterBlockingAtAdmissionAndCutover:holdCount,
      writerWaitedUntilProtectedReadCompleted:true,
      writerWaitedUntilTargetCommitAndHeadUnlock:true,
      remoteHeadMustMatchLocalGateOnEveryDemoRead:true,
      remoteUnavailableFailsClosed:true,
      revokedBYTEAAndRetryLedgerRemoved:true,
      readDeniedForNewlyAdvancedJournalUntilReplay:true,
      idempotentFinalReconciliation:true,
      noSupabaseOrProductionRouteChanges:true,
      limitations:[
        'Only one synthetic read path and role enforce the remote shared-head lock; all production reads/writes, caches, replicas and admin bypasses require separate controls.',
        'A same-runner pair of PG containers is not geographic durable offsite storage.',
        'Remote read locks held throughout each query add network latency and availability coupling; no throughput, failover or cost measurements.',
        'Cross-database transactions are NOT atomic and independent writer crash windows remain; real consent state and authentication require design.',
        'Hard-coded dummy CI HMAC is not a trusted tamper-proof anchor, GDPR certification or Supabase RLS proof.'
      ]
    }));
  }finally{
    await Promise.allSettled([
      remoteReader.end(),remoteWriter?.end(),remoteGate?.end(),
      remoteObserver?.end(),targetReader?.end(),targetWrite?.end()
    ]);
  }
}
main().catch(e=>{
  console.error('Coordinated restore cutover test FAILED:',e);
  process.exitCode=1;
});
