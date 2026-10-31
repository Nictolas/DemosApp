'use strict';
// TEST ONLY: PostgreSQL 17 synthetic cursor gap. No real GDPR records,
// B2, credentials, production database, restore, or provider access.
const test=require('node:test');
const assert=require('node:assert/strict');
const crypto=require('node:crypto');
const {Pool}=require('pg');

const URL='postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci';
const TABLE='gdpr_b2_cursor_gap_ci.events';
const digest=keys=>crypto.createHash('sha256')
  .update(JSON.stringify([...keys].sort())).digest('hex');
function guard(){
  const e=process.env;
  if(e.GITHUB_ACTIONS!=='true'||e.GDPR_OUTBOX_WORKER_CI!=='isolated'||
     e.TEST_DATABASE_URL!==URL||e.DATABASE_URL||e.SUPABASE_URL||
     e.SUPABASE_DB_URL||e.SUPABASE_SERVICE_ROLE_KEY||
     e.RENDER||e.RENDER_SERVICE_ID){
    throw Error('GDPR_B2_CURSOR_GAP_REFUSES_NONLOCAL_DATABASE');
  }
}
async function page(db,after,limit=1){
  const r=await db.query('SELECT event_key,occurred_at FROM '+TABLE+
    ' WHERE ($1::timestamptz IS NULL OR (occurred_at,event_key)>($1::timestamptz,$2::text))'+
    ' ORDER BY occurred_at,event_key LIMIT $3',[after?.occurred_at||null,after?.event_key||null,limit]);
  return r.rows;
}
async function add(db,key,time){
  await db.query('INSERT INTO '+TABLE+' (event_key,occurred_at) VALUES ($1,$2)',[key,time]);
}
test('PG17 synthetic: cursor scan cannot certify complete GDPR history',async t=>{
  guard();
  const db=new Pool({connectionString:URL,ssl:false,max:3});
  try{
    const identity=(await db.query("SELECT current_database() AS db,current_setting('server_version_num')::int AS v")).rows[0];
    assert.equal(identity.db,'gdpr_outbox_worker_ci');
    assert.equal(Math.floor(identity.v/10000),17);
    await db.query('CREATE SCHEMA gdpr_b2_cursor_gap_ci');
    await db.query('CREATE TABLE '+TABLE+' (event_key TEXT PRIMARY KEY,occurred_at TIMESTAMPTZ NOT NULL)');
    const first='synthetic-a',late='synthetic-backdated',last='synthetic-c';
    await add(db,first,'2026-10-30T10:00:00.000Z');
    await add(db,last,'2026-10-30T12:00:00.000Z');
    const seen=await page(db,null,1);
    assert.deepEqual(seen.map(x=>x.event_key),[first]);
    const cursor={event_key:seen[0].event_key,occurred_at:seen[0].occurred_at};

    await t.test('late committed event with earlier timestamp is invisible to later cursor pages',async()=>{
      const writer=await db.connect();
      try{
        await writer.query('BEGIN');
        await add(writer,late,'2026-10-30T09:00:00.000Z');
        await writer.query('COMMIT');
      }finally{writer.release();}
      const remaining=await page(db,cursor,10);
      assert.deepEqual(remaining.map(x=>x.event_key),[last]);
      const all=(await db.query('SELECT event_key FROM '+TABLE+' ORDER BY event_key')).rows.map(x=>x.event_key);
      assert.equal(all.length,3);
      assert.equal(seen.length+remaining.length,2);
      assert.ok(![...seen,...remaining].some(x=>x.event_key===late));
    });

    await t.test('even an empty final page does not establish independent completeness',async()=>{
      const afterLast=(await page(db,cursor,10)).at(-1);
      assert.equal((await page(db,afterLast,10)).length,0);
      assert.equal((await db.query('SELECT COUNT(*)::int AS n FROM '+TABLE)).rows[0].n,3);
    });

    await t.test('count equality alone can conceal a replaced event after stale restore',async()=>{
      const exported=[first,last];
      const restored=[late,last];
      assert.equal(exported.length,restored.length);
      assert.notEqual(digest(exported),digest(restored));
    });

    await t.test('an independently sealed keyset would detect omission, but is not implemented here',async()=>{
      const exported=[first,last];
      const external=(await db.query('SELECT event_key FROM '+TABLE)).rows.map(x=>x.event_key);
      assert.notEqual(digest(exported),digest(external));
      // The external list here is the SAME disposable SQL database.
      // It is NOT an independent witness and cannot authorize recovery.
    });
    console.log('GDPR_B2_CURSOR_GAP_PG17_SYNTHETIC_PASS');
  }finally{
    await db.query('DROP SCHEMA IF EXISTS gdpr_b2_cursor_gap_ci CASCADE');
    await db.end();
  }
});
