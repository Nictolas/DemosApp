'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { readApprovedPage, parseCursor } = require('../services/publicApprovedSubjectPage');
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