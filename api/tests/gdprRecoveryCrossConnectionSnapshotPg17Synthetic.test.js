'use strict';
// Isolated PostgreSQL 17 ONLY. Exercises pg_export_snapshot() and
// SET TRANSACTION SNAPSHOT for multiple readers on a temporary database.
// Never connects to Supabase/Render or B2; no actual backup or restore.
const test=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');

const URL='postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci';
const SCHEMA='gdpr_multireader_cut_ci';
const ACCOUNTS=SCHEMA+'.accounts';
const LEDGER=SCHEMA+'.ledger';
const USER='fictional_subject';
const validToken=/^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{8}-[0-9]+$/;
const safe=process.env.GITHUB_ACTIONS==='true' &&
  process.env.GDPR_OUTBOX_WORKER_CI==='isolated' &&
  process.env.TEST_DATABASE_URL===URL &&
  !process.env.DATABASE_URL && !process.env.SUPABASE_URL &&
  !process.env.SUPABASE_DB_URL && !process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !process.env.RENDER && !process.env.RENDER_SERVICE_ID;

function assertSafe() {
  if(!safe) throw Error('GDPR_MULTI_READER_REFUSES_NONLOCAL_PG17');
}
async function setup(pool) {
  await pool.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE');
  await pool.query('CREATE SCHEMA '+SCHEMA);
  await pool.query('CREATE TABLE '+ACCOUNTS+
    ' (id text PRIMARY KEY, consent boolean NOT NULL)');
  await pool.query('CREATE TABLE '+LEDGER+
    ' (event_id text PRIMARY KEY, subject text NOT NULL, action text NOT NULL)');
  await pool.query('INSERT INTO '+ACCOUNTS+' (id,consent) VALUES ($1,true)',[USER]);
}
async function atomicRevoke(pool) {
  const c=await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query('UPDATE '+ACCOUNTS+' SET consent=false WHERE id=$1',[USER]);
    await c.query('INSERT INTO '+LEDGER+
      ' (event_id,subject,action) VALUES ($1,$2,$3)',
      ['fictional-revoke',USER,'political_consent_revoked']);
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK').catch(()=>{});
    throw e;
  } finally {c.release();}
}
async function createExport(c) {
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  const r=await c.query('SELECT pg_export_snapshot() AS token,'+
    ' pg_current_snapshot()::text AS snapshot');
  const {token,snapshot}=r.rows[0];
  if(typeof token!=='string' || !validToken.test(token)) throw Error('GDPR_INVALID_EXPORTED_SNAPSHOT');
  return {token,snapshot};
}
async function importSnapshot(c,token) {
  // Real backup tooling must never interpolate caller-supplied SQL. This
  // synthetic token is the exact PostgreSQL-generated export format.
  if(typeof token!=='string' || !validToken.test(token))
    throw Error('GDPR_INVALID_EXPORTED_SNAPSHOT');
  await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
  // Snapshot must be set before ANY query in the importer transaction.
  await c.query("SET TRANSACTION SNAPSHOT '"+token+"'");
  const metadata=(await c.query("SELECT pg_current_snapshot()::text AS snapshot,"+
    " current_setting('transaction_isolation') AS isolation,"+
    " current_setting('transaction_read_only') AS ro")).rows[0];
  if(metadata.isolation!=='repeatable read' || metadata.ro!=='on')
    throw Error('GDPR_MULTIREADER_WRONG_ISOLATION');
  return metadata.snapshot;
}
async function observe(c) {
  const accounts=(await c.query('SELECT id,consent FROM '+ACCOUNTS)).rows;
  const events=(await c.query('SELECT event_id,action FROM '+LEDGER)).rows;
  return {exists:accounts.some(x=>x.id===USER),
    consent:accounts.find(x=>x.id===USER)?.consent,
    events:events.map(x=>x.event_id)};
}
async function cleanup(pool) {
  await pool.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE').catch(()=>{});
  await pool.end();
}
async function reader(pool) {
  const c=await pool.connect();
  return c;
}
if(!safe) {
  test('cross-session cut suite requires exact disposable PG17',
    {skip:'Refuses any non-CI or non-local PostgreSQL'},()=>{});
} else {
  test('two readers import ONE exported snapshot and agree after third writer commits',async()=>{
    assertSafe();
    const pool=new Pool({connectionString:URL,ssl:false,max:5});
    try {
      const version=Number((await pool.query('SHOW server_version_num')).rows[0].server_version_num);
      assert.equal(Math.floor(version/10000),17);
      await setup(pool);
      const original=await reader(pool),first=await reader(pool),second=await reader(pool);
      try {
        const anchor=await createExport(original);
        const a=await importSnapshot(first,anchor.token);
        const b=await importSnapshot(second,anchor.token);
        assert.equal(a,anchor.snapshot);
        assert.equal(b,anchor.snapshot);
        await atomicRevoke(pool);
        const observedA=await observe(first),observedB=await observe(second);
        assert.deepEqual(observedA,observedB);
        assert.deepEqual(observedA,{exists:true,consent:true,events:[]});
        assert.deepEqual(await observe(original),observedA);
        assert.equal((await observe(pool)).consent,false);
        assert.deepEqual((await observe(pool)).events,['fictional-revoke']);
        // Consistent does not mean fresh: both readers necessarily miss the
        // newly committed revocation until an independent replay.
      }finally {
        for(const c of [first,second,original]) {
          await c.query('ROLLBACK').catch(()=>{});
          c.release();
        }
      }
    }finally{await cleanup(pool);}
  });

  test('without imported snapshot two READ COMMITTED sessions can disagree',async()=>{
    assertSafe();
    const pool=new Pool({connectionString:URL,ssl:false,max:4});
    try {
      await setup(pool);
      const before=await reader(pool),after=await reader(pool);
      try {
        await before.query('BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY');
        const old=await observe(before);
        await atomicRevoke(pool);
        await after.query('BEGIN ISOLATION LEVEL READ COMMITTED READ ONLY');
        const fresh=await observe(after);
        assert.deepEqual(old,{exists:true,consent:true,events:[]});
        assert.deepEqual(fresh,{exists:true,consent:false,events:['fictional-revoke']});
        assert.notDeepEqual(old,fresh);
      }finally{
        for(const c of [before,after]){
          await c.query('ROLLBACK').catch(()=>{});
          c.release();
        }
      }
    }finally{await cleanup(pool);}
  });

  test('importing a snapshot AFTER first data query is rejected by PostgreSQL',async()=>{
    assertSafe();
    const pool=new Pool({connectionString:URL,ssl:false,max:3});
    try {
      await setup(pool);
      const exporter=await reader(pool),importer=await reader(pool);
      try {
        const exported=await createExport(exporter);
        await importer.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
        await importer.query('SELECT id FROM '+ACCOUNTS);
        await assert.rejects(
          importer.query("SET TRANSACTION SNAPSHOT '"+exported.token+"'"),
          /snapshot|first query|before any query/i);
      }finally{
        for(const c of [importer,exporter]){
          await c.query('ROLLBACK').catch(()=>{});
          c.release();
        }
      }
    }finally{await cleanup(pool);}
  });

  test('exported snapshot cannot be imported after exporter transaction ends',async()=>{
    assertSafe();
    const pool=new Pool({connectionString:URL,ssl:false,max:3});
    try {
      await setup(pool);
      const exporter=await reader(pool),importer=await reader(pool);
      try {
        const {token}=await createExport(exporter);
        await exporter.query('COMMIT');
        await assert.rejects(importSnapshot(importer,token),
          /invalid snapshot identifier|snapshot/i);
      }finally{
        for(const c of [importer,exporter]){
          await c.query('ROLLBACK').catch(()=>{});
          c.release();
        }
      }
    }finally{await cleanup(pool);}
  });

  test('non-PostgreSQL tokens are rejected before creating an importer transaction',async()=>{
    assertSafe();
    const pool=new Pool({connectionString:URL,ssl:false,max:2});
    try {
      await setup(pool);
      const c=await reader(pool);
      try {
        for(const token of ['',null,"foo'; DROP TABLE "+ACCOUNTS+'; --',
          '00000001-00000002-1 OR 1=1','../unsafe']){
          await assert.rejects(importSnapshot(c,token),
            /GDPR_INVALID_EXPORTED_SNAPSHOT/);
          const inTransaction=(await c.query(
            'SELECT txid_current_if_assigned() AS assigned')).rows[0].assigned;
          assert.equal(inTransaction,null);
        }
        assert.equal((await observe(c)).exists,true);
      }finally{c.release();}
    }finally{await cleanup(pool);}
  });
}
