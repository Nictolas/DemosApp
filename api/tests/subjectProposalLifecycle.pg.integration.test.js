'use strict';
// Runs real Express routes and the DRAFT migration on a disposable local PG17 service.
// Refuses production/staging connections; uses synthetic UUIDs and public example.org URLs only.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { Pool, Client } = require('pg');
const express = require('express');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const ADMIN = '33333333-3333-4333-8333-333333333333';
const SCHEMA = 'subject_it';
function localDatabaseUrl() {
  const raw = process.env.CIVIC_TEST_DATABASE_URL;
  assert.equal(process.env.CIVIC_TEST_MODE, 'isolated-synthetic');
  assert.ok(raw, 'Refusing to run without temporary test database');
  const u = new URL(raw);
  assert.equal(u.protocol, 'postgres:');
  assert.equal(u.hostname, '127.0.0.1', 'Never connect to production or staging');
  assert.equal(u.port, '5432');
  assert.equal(u.pathname, '/demos_civic_ci');
  return raw;
}
async function request(base, url, who, method = 'GET', body) {
  const resp = await fetch(base + url, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(who ? {authorization: 'Bearer ' + who} : {})
    },
    ...(body === undefined ? {} : {body: JSON.stringify(body)})
  });
  return {status: resp.status, body: await resp.json()};
}
const proposal = (category, title, details = '') => ({
  category, title, details, source_url: 'https://example.org/fonte-pubblica'
});

test('actual draft SQL and Express proposal API: unique pending, Admin review, publish, DSAR and no Grazia clone', async () => {
  const connectionString = localDatabaseUrl();
  const setup = new Client({connectionString});
  let pool, server;
  await setup.connect();
  try {
    // CI database is disposable. All app tables are isolated from other CI suites.
    await setup.query('CREATE SCHEMA ' + SCHEMA);
    await setup.query("CREATE TABLE " + SCHEMA + ".users (id uuid PRIMARY KEY, is_admin boolean NOT NULL DEFAULT false, ruolo text NOT NULL DEFAULT 'U', status text NOT NULL DEFAULT 'a')");
    await setup.query("CREATE TABLE " + SCHEMA + ".notifiche_demos (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), id_utente uuid, titolo text, testo text NOT NULL)");
    await setup.query("CREATE TABLE " + SCHEMA + ".amnistia (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), legge text, articolo text, descrizione text, fonte_url text, attiva boolean)");
    await setup.query("INSERT INTO " + SCHEMA + ".users(id,is_admin) VALUES ($1,false),($2,false),($3,true)", [A,B,ADMIN]);
    // Supabase roles are ordinarily present; provision them ONLY in ephemeral CI.
    await setup.query("DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$");
    const migration = fs.readFileSync(path.join(__dirname, '../migrations/20261031_subject_proposals_review_gate.sql'), 'utf8');
    assert.match(migration, /CREATE TABLE IF NOT EXISTS public.subject_proposals/);
    // Only the schema qualifier is replaced; constraints, indexes and RLS are unmodified.
    const migratedSql = migration.replaceAll('public.', SCHEMA + '.');
    await setup.query(migratedSql);

    // Simulate the old staging CHECK (five categories) and a legacy Grazia row.
    // Re-running the migration must fail closed without deleting that row.
    await setup.query('ALTER TABLE ' + SCHEMA + '.subject_proposals DROP CONSTRAINT subject_proposals_category_check');
    await setup.query("ALTER TABLE " + SCHEMA + ".subject_proposals ADD CONSTRAINT subject_proposals_category_check CHECK (category IN ('capo_stato','grazia','amnistia','attivisti','organizzazioni'))");
    await setup.query("INSERT INTO " + SCHEMA + ".subject_proposals(proposer_user_id,category,title,source_url) VALUES($1,'grazia','Persona sintetica legacy','https://example.org')",[A]);
    await assert.rejects(setup.query(migratedSql), e => /migration blocked: Grazia rows/.test(e.message),
      'legacy third-party rows must block the migration instead of being erased');
    const stillThere=await setup.query("SELECT COUNT(*)::integer n FROM " + SCHEMA + ".subject_proposals WHERE category='grazia'");
    assert.equal(stillThere.rows[0].n,1,'failed migration preserves legacy rows');
    // Only disposable fixture data is removed here; production migrations never DELETE.
    await setup.query("DELETE FROM " + SCHEMA + ".subject_proposals WHERE category='grazia'");
    await setup.query(migratedSql);
    const categoryCheck=await setup.query(
      "SELECT pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE conrelid=$1::regclass AND conname='subject_proposals_category_check'",
      [SCHEMA+'.subject_proposals']
    );
    assert.equal(categoryCheck.rows.length,1);
    assert.doesNotMatch(categoryCheck.rows[0].definition,/grazia/i,
      'reapplied migration must narrow the old staging CHECK');
    const rel = await setup.query("SELECT relrowsecurity FROM pg_class WHERE oid = $1::regclass", [SCHEMA+'.subject_proposals']);
    assert.equal(rel.rows[0].relrowsecurity, true);
    const rights = await setup.query("SELECT has_table_privilege('anon',$1,'SELECT') anon_can_read, has_table_privilege('authenticated',$1,'SELECT') auth_can_read", [SCHEMA+'.subject_proposals']);
    assert.equal(rights.rows[0].anon_can_read, false);
    assert.equal(rights.rows[0].auth_can_read, false);

    pool = new Pool({connectionString,max:16,options:'-c search_path=' + SCHEMA + ',public'});
    const dbPath = require.resolve('../config/database');
    const authPath = require.resolve('../middleware/auth');
    require.cache[dbPath] = {id:dbPath,filename:dbPath,loaded:true,exports:{getPool:() => pool}};
    const verifyToken = (req,res,next) => {
      const raw=req.headers.authorization;
      const id=raw==='Bearer a'?A:raw==='Bearer b'?B:raw==='Bearer admin'?ADMIN:null;
      if(!id) return res.status(401).json({success:false,error:'Unauthorized'});
      req.user={id,isAdmin:id===ADMIN};next();
    };
    const requireAdmin = (req,res,next) => req.user?.isAdmin?next():res.status(403).json({success:false});
    require.cache[authPath] = {id:authPath,filename:authPath,loaded:true,exports:{verifyToken,requireAdmin}};
    const app=express();app.use(express.json());
    app.use('/api/subject-proposals',require('../routes/subject-proposals'));
    server=http.createServer(app);
    await new Promise(done=>server.listen(0,'127.0.0.1',done));
    const base='http://127.0.0.1:'+server.address().port;
    const req=(uri,who,method,body)=>request(base,uri,who,method,body);

    assert.equal((await req('/api/subject-proposals',null,'POST',proposal('attivisti','Attivista sintetica'))).status,401);
    assert.equal((await req('/api/subject-proposals','a','POST',proposal('grazia','Persona sintetica'))).status,409);
    assert.equal((await req('/api/subject-proposals/mine?category=grazia','a')).status,409);
    assert.equal((await req('/api/subject-proposals','a','POST',{...proposal('attivisti','Persona sintetica'),source_url:'http://non-sicuro.example.org'})).status,400);
    const capo=proposal('capo_stato','Candidata sintetica approvabile');
    const concurrent=await Promise.all(Array.from({length:8},()=>req('/api/subject-proposals','a','POST',capo)));
    assert.equal(concurrent.filter(x=>x.status===201).length,1,'only one accepted concurrently');
    assert.equal(concurrent.filter(x=>x.status===409).length,7,'duplicates must fail atomically');
    const capoId=concurrent.find(x=>x.status===201).body.proposal.id;
    assert.equal((await req('/api/subject-proposals','a','POST',proposal('capo_stato','Altro candidato sintetico'))).status,409);
    assert.equal((await req('/api/subject-proposals','b','POST',capo)).status,409,'cross-user duplicate subject rejected');
    const own=await req('/api/subject-proposals/mine?category=capo_stato','a');
    const other=await req('/api/subject-proposals/mine?category=capo_stato','b');
    assert.equal(own.body.pending.id,capoId);
    assert.equal(other.body.pending,null);
    assert.equal((await req('/api/subject-proposals/admin','a')).status,403);
    const pending=await req('/api/subject-proposals/admin','admin');
    assert.equal(pending.status,200);
    assert.equal(pending.body.proposals.length,1);
    assert.equal(pending.body.proposals[0].id,capoId);
    assert.equal(Object.hasOwn(pending.body.proposals[0],'proposer_user_id'),false,'admin listing must not send proposer UUID');
    assert.equal(pending.body.proposals[0].title,capo.title,'review information is still available');
    const notices=await pool.query('SELECT id_utente,testo FROM notifiche_demos');
    assert.equal(notices.rows.length,1,'one Admin notification for one accepted proposal');
    assert.equal(notices.rows[0].id_utente,ADMIN);
    assert.equal(notices.rows[0].testo.includes(capo.title),false,'no third-party name leaked to preview');
    const notPublished=await pool.query('SELECT count(*)::integer n FROM capo_stato_soggetti_approvati');
    assert.equal(notPublished.rows[0].n,0,'pending not public');
    const approval=await req('/api/subject-proposals/admin/'+capoId+'/decision','admin','POST',{decision:'approve'});
    assert.equal(approval.status,200,JSON.stringify(approval.body));
    assert.equal(approval.body.status,'approved');
    assert.equal((await req('/api/subject-proposals/admin/'+capoId+'/decision','admin','POST',{decision:'approve'})).status,409);
    const publicCapo=await pool.query('SELECT nome,active,source_proposal_id FROM capo_stato_soggetti_approvati');
    assert.equal(publicCapo.rows.length,1);
    assert.equal(publicCapo.rows[0].nome,capo.title);
    assert.equal(publicCapo.rows[0].active,true);
    assert.equal(publicCapo.rows[0].source_proposal_id,capoId);
    assert.equal((await req('/api/subject-proposals','a','POST',proposal('capo_stato','Nuovo candidato sintetico'))).status,201,'new pending allowed after review');

    const amnistia=await req('/api/subject-proposals','a','POST',proposal('amnistia','Norma sintetica numero uno','Descrizione pubblica'));
    assert.equal(amnistia.status,201);
    const approvedAmnistia=await req('/api/subject-proposals/admin/'+amnistia.body.proposal.id+'/decision','admin','POST',{decision:'approve'});
    assert.equal(approvedAmnistia.status,200,JSON.stringify(approvedAmnistia.body));
    const active=await pool.query("SELECT legge,attiva FROM amnistia WHERE legge='Norma sintetica numero uno'");
    assert.equal(active.rows.length,1);
    assert.equal(active.rows[0].attiva,true);

    const org=await req('/api/subject-proposals','b','POST',proposal('organizzazioni','Organizzazione sintetica'));
    assert.equal(org.status,201);
    const publishedBefore=await req('/api/subject-proposals/approved?category=organizzazioni');
    assert.equal(publishedBefore.body.data.length,0);
    assert.equal((await req('/api/subject-proposals/admin/'+org.body.proposal.id+'/decision','admin','POST',{decision:'approve'})).status,200);
    const publishedAfter=await req('/api/subject-proposals/approved?category=organizzazioni');
    assert.equal(publishedAfter.body.data.length,1);
    assert.equal(publishedAfter.body.data[0].title,'Organizzazione sintetica');
    assert.deepEqual(Object.keys(publishedAfter.body.data[0]).sort(),['id','title'],
      'public approved listing must not disclose optional narratives, source URLs or proposer identities');

    const activist=await req('/api/subject-proposals','b','POST',proposal('attivisti','Attivista sintetica rifiutata'));
    assert.equal(activist.status,201);
    assert.equal((await req('/api/subject-proposals/admin/'+activist.body.proposal.id+'/decision','a','POST',{decision:'approve'})).status,403);
    assert.equal((await req('/api/subject-proposals/admin/'+activist.body.proposal.id+'/decision','admin','POST',{decision:'reject'})).status,200);
    const rejectedDirectory=await req('/api/subject-proposals/approved?category=attivisti');
    assert.equal(rejectedDirectory.body.data.length,0);

    // The CHECK prevents Grazia even if the API is bypassed.
    await assert.rejects(pool.query(
      "INSERT INTO subject_proposals(proposer_user_id,category,title,source_url) VALUES($1,'grazia','Persona sintetica','https://example.org')",[B]
    ), e=>e.code==='23514');

    // A removed proposer must not remain linked by an FK in an approved directory record.
    await pool.query('DELETE FROM users WHERE id=$1',[A]);
    const deleted=await pool.query('SELECT count(*)::integer n FROM subject_proposals WHERE proposer_user_id=$1',[A]);
    assert.equal(deleted.rows[0].n,0);
    const publicAfterDeletion=await pool.query('SELECT source_proposal_id FROM capo_stato_soggetti_approvati WHERE nome=$1',[capo.title]);
    assert.equal(publicAfterDeletion.rows[0].source_proposal_id,null);
  } finally {
    if(server?.listening) await new Promise(done=>server.close(done));
    if(pool) await pool.end();
    await setup.end();
  }
});
