'use strict';

// PostgreSQL 17 TEST-ONLY: demonstrates a torn GDPR snapshot and a consistent
// transaction snapshot. No actual backup, pg_restore, live provider or PII.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');

const URL='postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci';
const SCHEMA='gdpr_snapshot_cut_ci';
const ACCOUNTS=SCHEMA+'.accounts', LEDGER=SCHEMA+'.events';
const ALICE='synthetic-subject-a', BOB='synthetic-subject-b';
function assertOnlyDisposablePg17() {
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true' || e.GDPR_OUTBOX_WORKER_CI!=='isolated' ||
     e.TEST_DATABASE_URL!==URL || e.DATABASE_URL || e.SUPABASE_URL ||
     e.SUPABASE_DB_URL || e.SUPABASE_SERVICE_ROLE_KEY ||
     e.RENDER || e.RENDER_SERVICE_ID) {
    throw Error('GDPR_SNAPSHOT_CUT_REFUSES_NONLOCAL_PG17');
  }
}
function validateCrossTableCut(accounts,events) {
  // The model starts from two fictional existing accounts with consent=true.
  // A matching deletion must be reflected in the account row at the SAME
  // transaction cut. This does not cover unknown/unlogged GDPR mutations.
  const byId=new Map(accounts.map(x=>[x.id,x]));
  const ids=new Set();
  for(const x of events) {
    if(ids.has(x.event_id))throw Error('GDPR_MODEL_TORN_OR_DUPLICATE_EVENT');
    ids.add(x.event_id);
    if(x.action==='account_deleted') {
      if(byId.has(x.subject))throw Error('GDPR_MODEL_TORN_SNAPSHOT');
    } else if(x.action==='political_consent_revoked') {
      if(byId.get(x.subject)?.consent!==false)
        throw Error('GDPR_MODEL_TORN_SNAPSHOT');
    } else throw Error('GDPR_MODEL_UNSUPPORTED_ACTION');
  }
  return {syntheticCrossTableConsistent:true,
    productionRecoveryReady:false,completeGdprJournalVerified:false};
}
async function reset(pool) {
  await pool.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE');
  await pool.query('CREATE SCHEMA '+SCHEMA);
  await pool.query('CREATE TABLE '+ACCOUNTS+
    ' (id text PRIMARY KEY,consent boolean NOT NULL)');
  await pool.query('CREATE TABLE '+LEDGER+
    ' (event_id text PRIMARY KEY,subject text NOT NULL,action text NOT NULL)');
  await pool.query('INSERT INTO '+ACCOUNTS+' (id,consent) VALUES ($1,true),($2,true)',
    [ALICE,BOB]);
}
async function commitErasure(pool,subject,kind='account_deleted') {
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    if(kind==='account_deleted') {
      await c.query('DELETE FROM '+ACCOUNTS+' WHERE id=$1',[subject]);
    } else {
      await c.query('UPDATE '+ACCOUNTS+' SET consent=false WHERE id=$1',[subject]);
    }
    await c.query('INSERT INTO '+LEDGER+
      ' (event_id,subject,action) VALUES ($1,$2,$3)',
      [kind+'-'+subject,subject,kind]);
    await c.query('COMMIT');
  }catch(e){await c.query('ROLLBACK').catch(()=>{});throw e;}
  finally{c.release();}
}
async function readRows(c,sql) {return (await c.query(sql)).rows;}
async function metadata(c){
  return (await c.query(
    "SELECT current_setting('transaction_isolation') AS isolation, "+
    "current_setting('transaction_read_only') AS read_only, "+
    "pg_current_snapshot()::text AS snapshot"
  )).rows[0];
}
async function strictlyReadConsistentCut(c,onBetween=async()=>{}) {
  const meta=await metadata(c);
  if(meta.isolation!=='repeatable read' || meta.read_only!=='on' ||
      typeof meta.snapshot!=='string'||!meta.snapshot.length)
    throw Error('GDPR_MODEL_SNAPSHOT_TRANSACTION_REQUIRED');
  const accounts=await readRows(c,'SELECT id,consent FROM '+ACCOUNTS+' ORDER BY id');
  await onBetween();
  const events=await readRows(c,'SELECT event_id,subject,action FROM '+
    LEDGER+' ORDER BY event_id');
  const end=await metadata(c);
  if(end.isolation!==meta.isolation || end.read_only!==meta.read_only ||
      end.snapshot!==meta.snapshot)
    throw Error('GDPR_MODEL_SNAPSHOT_CHANGED');
  return {accounts,events,snapshot:meta.snapshot,
    ...validateCrossTableCut(accounts,events)};
}

if(process.env.GITHUB_ACTIONS!=='true' ||
   process.env.GDPR_OUTBOX_WORKER_CI!=='isolated' ||
   process.env.TEST_DATABASE_URL!==URL) {
  test('snapshot PG17 suite requires isolated CI',
    {skip:'No synthetic PostgreSQL service configured'},()=>{});
} else {
  test('PG17: a torn READ COMMITTED cut conflicts with one atomic delete',async t=>{
    assertOnlyDisposablePg17();
    const pool=new Pool({connectionString:URL,ssl:false,max:3});
    try{
      const version=(await pool.query(
        'SHOW server_version_num')).rows[0].server_version_num;
      assert.equal(Math.floor(Number(version)/10000),17);
      await reset(pool);
      const c=await pool.connect();
      try {
        await c.query('BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY');
        const accounts=await readRows(c,'SELECT id,consent FROM '+
          ACCOUNTS+' ORDER BY id');
        await commitErasure(pool,ALICE);
        const events=await readRows(c,'SELECT event_id,subject,action FROM '+
          LEDGER+' ORDER BY event_id');
        assert.ok(accounts.some(x=>x.id===ALICE));
        assert.equal(events.length,1);
        assert.throws(()=>validateCrossTableCut(accounts,events),
          /GDPR_MODEL_TORN_SNAPSHOT/);
        await c.query('COMMIT');
      }finally{c.release();}
    }finally{await pool.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE')
      .catch(()=>{});await pool.end();}
  });

  test('PG17: repeatable read gives stable account and event cut across concurrent commit',async()=>{
    assertOnlyDisposablePg17();
    const pool=new Pool({connectionString:URL,ssl:false,max:3});
    try{
      await reset(pool);
      const c=await pool.connect();
      try{
        await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const r=await strictlyReadConsistentCut(c,async()=>{
          await commitErasure(pool,ALICE);
        });
        assert.equal(r.syntheticCrossTableConsistent,true);
        assert.equal(r.productionRecoveryReady,false);
        assert.equal(r.completeGdprJournalVerified,false);
        assert.equal(r.events.length,0);
        assert.equal(r.accounts.length,2);
        await c.query('COMMIT');
        const live=await readRows(pool,'SELECT id FROM '+ACCOUNTS);
        assert.deepEqual(live.map(x=>x.id),[BOB]);
        const liveEvents=await readRows(pool,'SELECT event_id FROM '+LEDGER);
        assert.equal(liveEvents.length,1,
          'consistent snapshot can STILL be stale; external journal required');
      }finally{c.release();}
    }finally{await pool.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE')
      .catch(()=>{});await pool.end();}
  });

  test('PG17: same repeatable-read cut sees atomic revocation consistently',async()=>{
    assertOnlyDisposablePg17();
    const pool=new Pool({connectionString:URL,ssl:false,max:3});
    try{
      await reset(pool);
      await commitErasure(pool,ALICE,'political_consent_revoked');
      const c=await pool.connect();
      try{
        await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        const r=await strictlyReadConsistentCut(c);
        assert.equal(r.events.length,1);
        assert.equal(r.accounts.find(x=>x.id===ALICE).consent,false);
        assert.equal(r.productionRecoveryReady,false);
        await c.query('COMMIT');
      }finally{c.release();}
    }finally{await pool.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE')
      .catch(()=>{});await pool.end();}
  });

  test('PG17: a READ COMMITTED transaction cannot masquerade as an approved cut',async()=>{
    assertOnlyDisposablePg17();
    const pool=new Pool({connectionString:URL,ssl:false,max:2});
    try{
      await reset(pool);
      const c=await pool.connect();
      try{
        await c.query('BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY');
        await assert.rejects(strictlyReadConsistentCut(c),
          /GDPR_MODEL_SNAPSHOT_TRANSACTION_REQUIRED/);
        await c.query('ROLLBACK');
      }finally{c.release();}
    }finally{await pool.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE')
      .catch(()=>{});await pool.end();}
  });

  test('PG17: a writable transaction cannot masquerade as a readonly recovery cut',async()=>{
    assertOnlyDisposablePg17();
    const pool=new Pool({connectionString:URL,ssl:false,max:2});
    try{
      await reset(pool);
      const c=await pool.connect();
      try{
        await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ');
        await assert.rejects(strictlyReadConsistentCut(c),
          /GDPR_MODEL_SNAPSHOT_TRANSACTION_REQUIRED/);
        await c.query('ROLLBACK');
      }finally{c.release();}
    }finally{await pool.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE')
      .catch(()=>{});await pool.end();}
  });

  test('a consistent local cut cannot prove an unlogged mutation or full journal',()=>{
    const out=validateCrossTableCut([
      {id:ALICE,consent:true},{id:BOB,consent:true}
    ],[]);
    assert.equal(out.syntheticCrossTableConsistent,true);
    assert.equal(out.productionRecoveryReady,false);
    assert.equal(out.completeGdprJournalVerified,false);
    assert.throws(()=>validateCrossTableCut([
      {id:ALICE,consent:true}
    ],[{event_id:'synthetic-revoke',subject:ALICE,
      action:'political_consent_revoked'}]),/GDPR_MODEL_TORN_SNAPSHOT/);
  });
}
