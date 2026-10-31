'use strict';
// Disposable localhost PostgreSQL17 only. No Supabase, no real user data.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {Client}=require('pg');
const {inspectSchema}=require('../scripts/check-proposals-schema-readiness');
const SCHEMA='preflight_it';

test('read-only preflight: complete schema READY; drift and unsafe grants NO-GO',async()=>{
  const raw=process.env.CIVIC_TEST_DATABASE_URL;
  assert.equal(process.env.CIVIC_TEST_MODE,'isolated-synthetic');
  assert.ok(raw,'Refuse to touch any database without disposable CI configuration');
  const url=new URL(raw);
  assert.equal(url.hostname,'127.0.0.1');
  assert.equal(url.port,'5432');
  assert.equal(url.pathname,'/demos_civic_ci');
  const client=new Client({connectionString:raw});
  await client.connect();
  try{
    await client.query('CREATE SCHEMA '+SCHEMA);
    await client.query("CREATE TABLE "+SCHEMA+".users(id uuid PRIMARY KEY,ruolo text,is_admin boolean,status text)");
    await client.query("CREATE TABLE "+SCHEMA+".richieste_grazia(id varchar PRIMARY KEY,utente_id varchar,nome text,url_prova text,status text,data_creazione timestamptz)");
    await client.query("CREATE TABLE "+SCHEMA+".grazia_carcerati(id bigint PRIMARY KEY,nome text,attivo boolean)");
    await client.query("CREATE TABLE "+SCHEMA+".voti_grazia(id uuid,userid uuid,nome text,timestamp timestamptz)");
    await client.query("CREATE TABLE "+SCHEMA+".voti_capo_stato(id uuid,userid uuid,nome text,timestamp timestamptz)");
    await client.query("CREATE TABLE "+SCHEMA+".voti_amnistia(id uuid,userid uuid,legge text,amnistia_id integer)");
    await client.query("CREATE TABLE "+SCHEMA+".notifiche_demos(id uuid,id_utente uuid,titolo text,testo text,data_creazione timestamptz,data date)");
    await client.query("CREATE TABLE "+SCHEMA+".amnistia(id integer,legge text,articolo text,descrizione text,fonte_url text,attiva boolean)");
    await client.query("DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF; IF NOT EXISTS(SELECT 1 FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF; END $$");
    const sql=fs.readFileSync(path.join(__dirname,'../migrations/20261031_subject_proposals_review_gate.sql'),'utf8');
    await client.query(sql.replaceAll('public.',SCHEMA+'.'));

    const queries=[];
    const observer={query:(statement,parameters)=>{
      queries.push(String(statement));
      assert.match(String(statement),/^\s*SELECT\b/i,'Inspector must only issue metadata SELECT');
      return client.query(statement,parameters);
    }};
    const ready=await inspectSchema(observer,{schema:SCHEMA});
    assert.equal(ready.ready,true,JSON.stringify(ready.problems));
    assert.deepEqual(ready.problems,[]);
    assert.equal(ready.categoryCount,4);
    assert.equal(queries.length,5,'only five catalog reads for whole schema audit');
    for(const statement of queries){
      assert.doesNotMatch(statement,/\bSELECT\s+\*\s+FROM\s+users\b/i,'No user content reads');
    }

    // Reproduce the old index which excluded withdrawn names. A full schema
    // checker must reject it and the draft migration must upgrade it atomically.
    await client.query('DROP INDEX '+SCHEMA+'.subject_proposals_no_duplicate_open_titles');
    await client.query(
      "CREATE UNIQUE INDEX subject_proposals_no_duplicate_open_titles ON "+SCHEMA+
      ".subject_proposals(category,lower(btrim(title))) WHERE status IN ('pending','approved')"
    );
    const unprotected=await inspectSchema(observer,{schema:SCHEMA});
    assert.equal(unprotected.ready,false);
    assert.ok(unprotected.problems.some(p=>p.code==='WITHDRAWN_TITLE_UNPROTECTED'));
    await client.query(sql.replaceAll('public.',SCHEMA+'.'));
    assert.equal((await inspectSchema(observer,{schema:SCHEMA})).ready,true,
      'reapplying the migration must restore withdrawal-aware uniqueness');
    const upgradedIndex=await client.query(
      "SELECT indexdef FROM pg_indexes WHERE schemaname=$1 AND indexname='subject_proposals_no_duplicate_open_titles'",[SCHEMA]
    );
    assert.match(upgradedIndex.rows[0].indexdef,/withdrawn/i);

    // Reproduce an older staging status CHECK; the preflight must reject it.
    await client.query('ALTER TABLE '+SCHEMA+'.subject_proposals DROP CONSTRAINT subject_proposals_status_check');
    await client.query("ALTER TABLE "+SCHEMA+".subject_proposals ADD CONSTRAINT subject_proposals_status_check CHECK (status IN ('pending','approved','rejected'))");
    let oldStatus=await inspectSchema(observer,{schema:SCHEMA});
    assert.equal(oldStatus.ready,false);
    assert.ok(oldStatus.problems.some(p=>p.code==='STATUS_CHECK_DRIFT'));
    await client.query(sql.replaceAll('public.',SCHEMA+'.'));
    assert.equal((await inspectSchema(observer,{schema:SCHEMA})).ready,true,
      're-applying draft migration must upgrade the old status check');

    await client.query('ALTER TABLE '+SCHEMA+'.users DROP COLUMN status');
    let result=await inspectSchema(observer,{schema:SCHEMA});
    assert.equal(result.ready,false);
    assert.ok(result.problems.some(p=>p.code==='MISSING_COLUMN'&&p.object==='users.status'));

    await client.query('ALTER TABLE '+SCHEMA+'.subject_proposals DROP CONSTRAINT subject_proposals_category_check');
    await client.query("ALTER TABLE "+SCHEMA+".subject_proposals ADD CONSTRAINT subject_proposals_category_check CHECK (category IN ('capo_stato','grazia','amnistia','attivisti','organizzazioni'))");
    result=await inspectSchema(observer,{schema:SCHEMA});
    assert.ok(result.problems.some(p=>p.code==='CATEGORY_CHECK_DRIFT'));
    assert.equal(result.ready,false);

    await client.query('GRANT SELECT ON '+SCHEMA+'.subject_proposals TO authenticated');
    result=await inspectSchema(observer,{schema:SCHEMA});
    assert.ok(result.problems.some(p=>p.code==='DIRECT_CLIENT_ACCESS'&&p.object==='subject_proposals.authenticated'));

    await client.query('ALTER TABLE '+SCHEMA+'.subject_proposals DISABLE ROW LEVEL SECURITY');
    result=await inspectSchema(observer,{schema:SCHEMA});
    assert.ok(result.problems.some(p=>p.code==='RLS_DISABLED'));
    assert.equal(result.ready,false);
  }finally{
    await client.end();
  }
});
