'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { readApprovedPage, parseCursor } = require('../services/publicApprovedSubjectPage');
test('noncanonical public approved cursors are rejected before querying any database',async()=>{
 const alphabet='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
 const id='11111111-1111-4111-8111-111111111111';
 // Select a legitimate 2- or 3-character final base64url quantum.
 const canonical=['1','12','123','1234']
  .map(epoch=>Buffer.from(JSON.stringify([epoch,id])).toString('base64url'))
  .find(raw=>[2,3].includes(raw.length%4));
 assert.ok(canonical,'fixture needs unused bits in final base64url character');
 const tail=alphabet.indexOf(canonical.at(-1));
 assert.notEqual(tail,-1);
 assert.equal(tail&1,0,'canonical encoding must have zero unused low bit');
 const alias=canonical.slice(0,-1)+alphabet[tail|1];
 assert.notEqual(alias,canonical);
 assert.equal(Buffer.from(alias,'base64url').toString('utf8'),
  Buffer.from(canonical,'base64url').toString('utf8'),
  'both spellings decode to identical JSON with permissive Node decoder');
 assert.ok(Array.isArray(parseCursor(canonical)),'real generated cursor stays accepted');
 assert.equal(parseCursor(alias),false,'alternate spelling of an identical cursor is forbidden');

 let sqlReads=0;
 const offlinePool={query:async()=>{sqlReads++;throw Error('SYNTHETIC_SQL_SHOULD_NOT_RUN')}};
 assert.equal(await readApprovedPage(offlinePool,'attivisti',alias),null);
 assert.equal(sqlReads,0,'invalid cursor must be rejected before SQL');
});

test('105 approved nominations/category: microsecond cursor, no duplicates, withdrawn excluded, minimal JSON', async()=>{
 const raw=process.env.CIVIC_TEST_DATABASE_URL;
 assert.equal(process.env.CIVIC_TEST_MODE,'isolated-synthetic');
 assert.ok(raw,'explicit disposable database required');
 const url=new URL(raw);
 assert.equal(url.protocol,'postgres:');
 assert.equal(url.hostname,'127.0.0.1');
 assert.equal(url.port,'5432');
 assert.equal(url.pathname,'/demos_civic_ci');
 const client=new Client({connectionString:raw});
 await client.connect();
 try{
  const identity=await client.query("SELECT current_database() db,current_user usr,current_setting('server_version_num')::int version");
  assert.equal(identity.rows[0].db,'demos_civic_ci');
  assert.equal(identity.rows[0].usr,'demos_ci');
  assert.ok(identity.rows[0].version>=170000);
  await client.query('CREATE SCHEMA public_page_it');
  await client.query('SET search_path TO public_page_it, public');
  await client.query(`CREATE TABLE subject_proposals(
    id uuid PRIMARY KEY,category text NOT NULL,title text NOT NULL,
    status text NOT NULL,created_at timestamptz NOT NULL,reviewed_at timestamptz)`);
  for(const [category,prefix] of [['attivisti','9'],['organizzazioni','a']]){
   await client.query(`INSERT INTO subject_proposals(id,category,title,status,created_at,reviewed_at)
    SELECT ($2 || '0000000-0000-4000-8000-' || lpad(i::text,12,'0'))::uuid,
     $1,'Synthetic subject '||i,'approved',
     '2026-11-04T00:00:00.000001Z'::timestamptz,
     CASE WHEN i>90 THEN '2026-11-05T00:00:00.123457Z'::timestamptz
          ELSE '2026-11-05T00:00:00.123456Z'::timestamptz END
    FROM generate_series(1,105) i`,[category,prefix]);
  }
  await client.query(`INSERT INTO subject_proposals VALUES
    ('90000000-0000-4000-8000-000000009999','attivisti',
     'WITHDRAWN_SECRET','withdrawn','2026-11-04T00:00:00Z','2026-11-05T00:00:00.999999Z')`);
  for(const category of ['attivisti','organizzazioni']){
   const first=await readApprovedPage(client,category);
   assert.equal(first.data.length,100);
   assert.ok(first.next_cursor);
   const second=await readApprovedPage(client,category,first.next_cursor);
   assert.equal(second.data.length,5);
   assert.equal(second.next_cursor,null);
   const all=[...first.data,...second.data];
   assert.equal(new Set(all.map(x=>x.id)).size,105);
   assert.ok(all.every(x=>Object.keys(x).sort().join(',')==='id,title'));
   assert.ok(all.every(x=>!x.title.includes('WITHDRAWN')));
   assert.ok(all.every(x=>x.id.startsWith(category==='attivisti'?'90000000':'a0000000')));

   // Synthetic DSAR/urgent unpublish regression: a visitor may already hold
   // a pagination cursor when an Admin withdraws a previously approved name.
   // Apply only a synthetic status transition; no DEMOS data or live route.
   const withdrawn=second.data.at(-1);
   const update=await client.query(
    "UPDATE subject_proposals SET status='withdrawn' WHERE id=$1 AND category=$2 AND status='approved' RETURNING id",
    [withdrawn.id,category]
   );
   assert.equal(update.rowCount,1,'synthetic withdrawal must affect one approved row');
   const staleCursorPage=await readApprovedPage(client,category,first.next_cursor);
   assert.equal(staleCursorPage.data.length,4,'withdrawn row must vanish even for an old cursor');
   assert.equal(staleCursorPage.next_cursor,null);
   assert.ok(staleCursorPage.data.every(x=>x.id!==withdrawn.id));
   assert.ok(staleCursorPage.data.every(x=>Object.keys(x).sort().join(',')==='id,title'));
   const freshFirst=await readApprovedPage(client,category);
   const freshSecond=await readApprovedPage(client,category,freshFirst.next_cursor);
   const afterWithdrawal=[...freshFirst.data,...freshSecond.data];
   assert.equal(afterWithdrawal.length,104,'104 synthetic approved names remain');
   assert.equal(new Set(afterWithdrawal.map(x=>x.id)).size,104);
   assert.ok(afterWithdrawal.every(x=>x.id!==withdrawn.id));
   assert.ok(afterWithdrawal.every(x=>Object.keys(x).sort().join(',')==='id,title'));
  }
  assert.equal(parseCursor('bad*!'),false);
  assert.equal(parseCursor(Buffer.from(JSON.stringify(['1','badid'])).toString('base64url')),false);
  assert.equal(await readApprovedPage(client,'attivisti','bad*!'),null);
 }finally{
  await client.query('RESET search_path').catch(()=>{});
  await client.query('DROP SCHEMA IF EXISTS public_page_it CASCADE').catch(()=>{});
  await client.end();
 }
});