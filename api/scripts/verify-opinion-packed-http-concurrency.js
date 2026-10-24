'use strict';

/**
 * CI-ONLY HTTP/SQL concurrency probe. All schema writes are confined to a
 * disposable PostgreSQL 17 service in GitHub Actions, with fake users/votes.
 * This router is NEVER installed by the DEMOS API, and does not validate
 * production Supabase policies, authentication, revocation or Android.
 */
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const {Pool} = require('pg');
const {
  createCatalogRegistry, encodeEnvelope, decodeEnvelope
} = require('../utils/opinionCodecEnvelope');
const {normalizeOpinionAnswer} = require('../utils/politicalMatching');

const DB = 'opinion_bitset_ci';
const SCHEMA = 'ci_opinion_http_concurrency_247';
const VERSIONS = SCHEMA + '.versions';
const VOTES = SCHEMA + '.votes';
const BASE_IDS = ['synthetic_alpha','synthetic_beta','synthetic_gamma','synthetic_delta'];
const EXPANDED_IDS = [...BASE_IDS,'synthetic_epsilon'];
const FORMATS = ['fixed','trimmed','sparse'];
const LOCK_CLASS = 2470033;
const APPEND_LOCK = 2470034;

function refuseNonEphemeral() {
  const env = process.env;
  if (env.GITHUB_ACTIONS !== 'true' ||
      env.OPINION_BENCH_EPHEMERAL !== 'yes' ||
      env.PGHOST !== '127.0.0.1' ||
      env.PGPORT !== '5432' ||
      env.PGDATABASE !== DB ||
      env.PGUSER !== 'postgres' ||
      env.PGPASSWORD !== 'synthetic-only') {
    throw new Error('HTTP concurrency experiment requires disposable GitHub Actions PostgreSQL');
  }
}

function connectPool() {
  return new Pool({
    host:'127.0.0.1',port:5432,database:DB,user:'postgres',
    password:'synthetic-only',max:8,statement_timeout:15000,
    application_name:'ci_opinion_http_synthetic_only'
  });
}

async function prepareSyntheticTables(pool) {
  const connection = await pool.connect();
  try {
    const check = await connection.query(
      'SELECT current_database() AS db, current_user::text AS role_name');
    assert.deepEqual(check.rows,[{db:DB,role_name:'postgres'}]);
    await connection.query('CREATE SCHEMA ' + SCHEMA);
    await connection.query('CREATE TABLE ' + VERSIONS +
      ' (version integer PRIMARY KEY CHECK (version>0), ' +
      "ordered_ids jsonb NOT NULL CHECK (jsonb_typeof(ordered_ids)='array'), " +
      "fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'))");
    await connection.query('CREATE TABLE ' + VOTES +
      ' (subject text PRIMARY KEY, revision integer NOT NULL CHECK (revision>0), ' +
      'catalog_version integer NOT NULL REFERENCES ' + VERSIONS + '(version), ' +
      "format text NOT NULL CHECK (format IN ('fixed','trimmed','sparse')), " +
      'catalog_fingerprint text NOT NULL, payload bytea NOT NULL)');
    const catalog = createCatalogRegistry([{version:1,ids:BASE_IDS}]).get(1);
    await connection.query('INSERT INTO '+VERSIONS+
      ' (version,ordered_ids,fingerprint) VALUES ($1,$2::jsonb,$3)',
      [1,JSON.stringify(catalog.ids),catalog.fingerprint]);
  } finally {
    connection.release();
  }
}

async function registryFromSQL(connection) {
  const r = await connection.query('SELECT version,ordered_ids,fingerprint FROM '+
    VERSIONS+' ORDER BY version');
  if(!r.rows.length) throw new Error('No synthetic catalog');
  const specs=r.rows.map(row=>({version:row.version,ids:row.ordered_ids}));
  const registry=createCatalogRegistry(specs);
  for (const row of r.rows) {
    if (registry.get(row.version).fingerprint!==row.fingerprint) {
      throw new RangeError('Catalog fingerprint mismatch');
    }
  }
  return registry;
}

function fromSQL(row) {
  if(!row) return null;
  return {
    schemaVersion:1,catalogVersion:row.catalog_version,
    catalogFingerprint:row.catalog_fingerprint,
    encoding:row.format,payload:row.payload
  };
}

function liveRowSQL(connection,subject,forUpdate=false) {
  return connection.query('SELECT subject,revision,catalog_version,format,'+
    'catalog_fingerprint,payload FROM '+VOTES+' WHERE subject=$1'+
    (forUpdate?' FOR UPDATE':''),[subject]);
}

async function appendCatalog(pool,ids) {
  const connection=await pool.connect();
  try {
    await connection.query('BEGIN');
    await connection.query('SELECT pg_advisory_xact_lock($1,$2)',
      [LOCK_CLASS,APPEND_LOCK]);
    const registry=await registryFromSQL(connection);
    const specs=registry.versions.map(version=>({
      version,ids:registry.get(version).ids
    }));
    const next=registry.latestVersion+1;
    const expanded=createCatalogRegistry([...specs,{version:next,ids}]);
    const catalog=expanded.get(next);
    await connection.query('INSERT INTO '+VERSIONS+
      ' (version,ordered_ids,fingerprint) VALUES ($1,$2::jsonb,$3)',
      [next,JSON.stringify(catalog.ids),catalog.fingerprint]);
    await connection.query('COMMIT');
    return next;
  } catch(e) {
    await connection.query('ROLLBACK');
    throw e;
  } finally {
    connection.release();
  }
}

function mountSyntheticHttp(pool) {
  const app=express();
  app.disable('x-powered-by');
  app.use(express.json({limit:'16kb'}));
  const allowedUsers=new Set();
  const consents=new Map();
  for (const format of FORMATS) {
    for (const suffix of ['a','b']) {
      const subject='synthetic-'+format+'-'+suffix;
      allowedUsers.add(subject);
      consents.set(subject,true);
    }
  }
  const counters={inserted:0,updated:0,denied:0};
  const router=express.Router();

  router.use((req,res,next)=>{
    const authorization=req.get('authorization');
    const subject=authorization?.startsWith('Bearer ')
      ? authorization.slice(7) : null;
    if (!allowedUsers.has(subject)) {
      return res.status(401).json({success:false,error:'Autenticazione richiesta'});
    }
    req.syntheticAccount=subject;
    next();
  });

  router.get('/opinioni-list',async(req,res)=>{
    res.set('Cache-Control','private, no-store, max-age=0');
    res.vary('Authorization');
    try {
      if (!req.query.grado) {
        return res.status(400).json({success:false,error:'Grado richiesto',
          message:'Il parametro grado è obbligatorio'});
      }
      const registry=await registryFromSQL(pool);
      const ids=registry.get(registry.latestVersion).ids;
      const result=await liveRowSQL(pool,req.syntheticAccount);
      const stored=result.rows[0]||null;
      const values=stored?decodeEnvelope(registry,fromSQL(stored)):{};
      const data=ids.map((id,index)=>({
        id,text:'Synthetic '+index,grado:['N'],userAnswer:values[id]??null
      }));
      return res.json({success:true,data,grado:req.query.grado,total:data.length});
    } catch(e) {
      return res.status(500).json({success:false,error:'Errore interno del server'});
    }
  });

  router.post('/opinioni/salva',async(req,res)=>{
    const subject=req.syntheticAccount;
    if (!consents.get(subject)) {
      counters.denied++;
      return res.status(403).json({success:false,error:'Consenso richiesto',
        message:'Per salvare opinioni politiche è necessario un consenso esplicito attivo.',
        consent_required:true});
    }
    const body=req.body?.opinioni||req.body;
    if (!body || typeof body!=='object' || Array.isArray(body) ||
        Object.keys(body).length===0) {
      return res.status(400).json({success:false,error:'Dati mancanti',
        message:'Il campo opinioni è obbligatorio'});
    }
    const client=await pool.connect();
    let inTransaction=false;
    try {
      await client.query('BEGIN');
      inTransaction=true;
      // Transaction-scoped account lock covers the no-row/first-save race.
      // Revision-guarded UPDATE is a second, explicit CAS defense.
      await client.query('SELECT pg_advisory_xact_lock($1,hashtext($2))',
        [LOCK_CLASS,subject]);
      if (!consents.get(subject)) {
        await client.query('ROLLBACK');
        inTransaction=false;
        counters.denied++;
        return res.status(403).json({success:false,error:'Consenso richiesto',
          message:'Per salvare opinioni politiche è necessario un consenso esplicito attivo.',
          consent_required:true});
      }
      const registry=await registryFromSQL(client);
      const allowed=new Set(registry.get(registry.latestVersion).ids);
      const changes={};
      let errorCount=0;
      for (const [id,value] of Object.entries(body)) {
        const normalized=normalizeOpinionAnswer(value);
        if (!allowed.has(id)||!normalized) {
          errorCount++;
        } else {
          changes[id]=normalized;
        }
      }
      if (!Object.keys(changes).length) {
        await client.query('ROLLBACK');
        inTransaction=false;
        return res.status(400).json({success:false,
          error:'Nessuna opinione valida da salvare',
          message:'Verifica che le opinioni corrispondano ai campi disponibili'});
      }
      const existing=(await liveRowSQL(client,subject,true)).rows[0];
      const answers=existing?decodeEnvelope(registry,fromSQL(existing)):{};
      const format=subject.split('-')[1];
      assert.ok(FORMATS.includes(format));
      const envelope=encodeEnvelope(registry,{
        version:registry.latestVersion,encoding:format,
        answers:{...answers,...changes}
      });
      let revision;
      if(existing) {
        const updated=await client.query('UPDATE '+VOTES+
          ' SET revision=revision+1,catalog_version=$1,format=$2,'+
          ' catalog_fingerprint=$3,payload=$4 WHERE subject=$5 AND revision=$6'+
          ' RETURNING revision',[
            envelope.catalogVersion,format,envelope.catalogFingerprint,
            envelope.payload,subject,existing.revision
          ]);
        if(updated.rowCount!==1)throw Error('Revision CAS conflict');
        revision=updated.rows[0].revision;
      }else{
        const inserted=await client.query('INSERT INTO '+VOTES+
          ' (subject,revision,catalog_version,format,catalog_fingerprint,payload)'+
          ' VALUES ($1,1,$2,$3,$4,$5) RETURNING revision',[
            subject,envelope.catalogVersion,format,
            envelope.catalogFingerprint,envelope.payload
          ]);
        assert.equal(inserted.rowCount,1);
        revision=1;
      }
      await client.query('COMMIT');
      inTransaction=false;
      counters[revision===1?'inserted':'updated']++;
      return res.json({success:true,message:'Opinioni salvate con successo',
        savedCount:Object.keys(changes).length,errorCount,
        notificationsCreated:0,timestamp:new Date().toISOString()});
    }catch(e){
      if(inTransaction)await client.query('ROLLBACK');
      return res.status(500).json({success:false,error:'Errore interno del server'});
    }finally{
      client.release();
    }
  });

  app.use('/_ci/api',router);
  return {app,consents,counters};
}

async function callHTTP(base,method,endpoint,subject,body) {
  const res=await fetch(base+'/_ci/api'+endpoint,{
    method,headers:{
      authorization:'Bearer '+subject,
      ...(body?{'content-type':'application/json'}:{})
    },
    ...(body?{body:JSON.stringify(body)}:{})
  });
  return {status:res.status,body:await res.json()};
}

async function readSyntheticRaw(pool,subject) {
  const result=await liveRowSQL(pool,subject);
  return result.rows[0]||null;
}

async function run() {
  refuseNonEphemeral();
  const pool=connectPool();
  let server;
  try {
    await prepareSyntheticTables(pool);
    const {app,consents,counters}=mountSyntheticHttp(pool);
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    let disjointPairs=0;
    let reencoded=0;
    for(const format of FORMATS) {
      const account='synthetic-'+format+'-a';
      const other='synthetic-'+format+'-b';
      // Two first-ever HTTP writes race on the same nonexistent SQL row.
      const writes=await Promise.all([
        callHTTP(base,'POST','/opinioni/salva',account,
          {opinioni:{synthetic_alpha:'f'}}),
        callHTTP(base,'POST','/opinioni/salva',account,
          {opinioni:{synthetic_beta:'c'}})
      ]);
      assert.ok(writes.every(r=>r.status===200));
      const read=await callHTTP(base,'GET','/opinioni-list?grado=N',account);
      assert.equal(read.status,200);
      const votes=Object.fromEntries(read.body.data.map(x=>[x.id,x.userAnswer]));
      assert.equal(votes.synthetic_alpha,'f');
      assert.equal(votes.synthetic_beta,'c');
      assert.equal(votes.synthetic_gamma,null);
      const row=await readSyntheticRaw(pool,account);
      assert.equal(row.revision,2,'both simultaneous first writes must commit');
      assert.equal(row.catalog_version,1);
      assert.equal(row.format,format);
      assert.ok(Buffer.isBuffer(row.payload));
      disjointPairs++;

      // Other users remain isolated, even with an overlapping opinion slot.
      assert.equal((await callHTTP(base,'POST','/opinioni/salva',other,
        {opinioni:{synthetic_alpha:'i'}})).status,200);
      const otherRead=await callHTTP(base,'GET','/opinioni-list?grado=N',other);
      assert.equal(otherRead.body.data[0].userAnswer,'i');
      assert.equal((await callHTTP(base,'GET','/opinioni-list?grado=N',account))
        .body.data[0].userAnswer,'f');
      const before=await readSyntheticRaw(pool,account);
      const rejected=await callHTTP(base,'POST','/opinioni/salva',account,{
        opinioni:{synthetic_delta:null,unknown:'i'}
      });
      assert.equal(rejected.status,400);
      const after=await readSyntheticRaw(pool,account);
      assert.equal(after.revision,before.revision);
      assert.ok(after.payload.equals(before.payload));
      consents.set(account,false);
      const forbidden=await callHTTP(base,'POST','/opinioni/salva',account,
        {opinioni:{synthetic_alpha:'c'}});
      assert.equal(forbidden.status,403);
      assert.equal((await readSyntheticRaw(pool,account)).revision,2);
      consents.set(account,true);
    }

    // Persist version 2, then use new HTTP writes to upgrade v1 rows
    // without dropping existing answers or leaking binary metadata.
    assert.equal(await appendCatalog(pool,EXPANDED_IDS),2);
    for(const format of FORMATS){
      const account='synthetic-'+format+'-a';
      const old=await readSyntheticRaw(pool,account);
      assert.equal(old.catalog_version,1);
      const before=await callHTTP(base,'GET','/opinioni-list?grado=N',account);
      assert.equal(before.body.data.at(-1).userAnswer,null);
      const writes=await Promise.all([
        callHTTP(base,'POST','/opinioni/salva',account,
          {opinioni:{synthetic_epsilon:'i'}}),
        callHTTP(base,'POST','/opinioni/salva',account,
          {opinioni:{synthetic_gamma:'f'}})
      ]);
      assert.ok(writes.every(r=>r.status===200));
      const after=await readSyntheticRaw(pool,account);
      assert.equal(after.revision,4);
      assert.equal(after.catalog_version,2);
      const get=await callHTTP(base,'GET','/opinioni-list?grado=N',account);
      assert.equal(get.status,200);
      assert.deepEqual(Object.fromEntries(get.body.data.map(q=>[
        q.id,q.userAnswer
      ])),{
        synthetic_alpha:'f',synthetic_beta:'c',
        synthetic_gamma:'f',synthetic_delta:null,synthetic_epsilon:'i'
      });
      assert.equal(Object.hasOwn(get.body,'payload'),false);
      assert.equal(Object.hasOwn(get.body,'catalogVersion'),false);
      reencoded++;
    }

    // Exact SQL aggregate of the race result, no account/vote details printed.
    const result=await pool.query('SELECT COUNT(*)::int AS n, '+
      ' SUM(revision)::int AS total_revisions FROM '+VOTES);
    assert.equal(result.rows[0].n,6);
    assert.equal(result.rows[0].total_revisions,15); // A:4*3; B:1*3
    console.log('OPINION_PACKED_HTTP_CONCURRENCY_PASS');
    console.log('OPINION_PACKED_HTTP_RESULT_JSON='+JSON.stringify({
      postgres:17,formats:FORMATS,
      simultaneousFirstSavePairs:disjointPairs,
      disjointConcurrentWritesPreserved:true,
      catalogVersions:[1,2],
      simultaneousPostUpgradePairs:reencoded,
      accountIsolation:true,invalidPostDoesNotWrite:true,
      deniedPostDoesNotWrite:true,revisionCAS:true,
      jsonLegacyFieldsPreserved:true,
      syntheticAccounts:result.rows[0].n,
      realRoutesWired:false,realSupabaseAccess:false,
      note:'CI-only model: not deployed route, real RLS, consent DELETE or Android'
    }));
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    await pool.end();
  }
}

run().catch(e=>{
  console.error('Synthetic HTTP/SQL concurrency test FAILED:',e);
  process.exitCode=1;
});
