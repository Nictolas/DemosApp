'use strict';

/**
 * Synthetic-only PostgreSQL 17 / real Express routes concurrency test.
 * Verifies consent revoke and opinion save serialize on users.id.
 * Never connects to production, Supabase or Render.
 */
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const {Pool} = require('pg');

const DB = 'political_consent_race_ci';
const ID = '00000000-0000-4000-8000-000000000125';
const gate = () => {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return {promise, resolve};
};
const baseEnv = process.env;
function guard(){
  const e=baseEnv;
  if (e.GITHUB_ACTIONS !== 'true' || e.POLITICAL_CONSENT_RACE_CI !== 'synthetic' ||
      e.PGHOST !== '127.0.0.1' || e.PGPORT !== '5432' ||
      e.PGDATABASE !== DB || e.PGUSER !== 'postgres' ||
      e.PGPASSWORD !== 'synthetic-only' ||
      e.DATABASE_URL || e.SUPABASE_URL || e.RENDER || e.SUPABASE_DB_URL ||
      e.SUPABASE_SERVICE_ROLE_KEY) {
    throw Error('Refuse any non-local synthetic Postgres');
  }
}
function sourceSql(s) { return String(s).replace(/\s+/g,' ').trim(); }
function timeout(p, ms=9000){
  return Promise.race([p,new Promise((_,reject)=>
    setTimeout(()=>reject(Error('Synthetic concurrency lock timed out')),ms))]);
}

async function main(){
  guard();
  const real=new Pool({
    host:'127.0.0.1',port:5432,database:DB,user:'postgres',
    password:'synthetic-only',max:3,statement_timeout:8000,
    connectionTimeoutMillis:3500,application_name:'synthetic_consent_race'
  });
  const paths=[
    require.resolve('../middleware/auth'),
    require.resolve('../services/auditService'),
    require.resolve('../services/privacyErasureLedgerService'),
    require.resolve('../services/politicalConsentService'),
    require.resolve('../routes/opinioni/user-answers'),
    require.resolve('../routes/user/political-opinions-consent'),
    require.resolve('../routes/users/profile'),
    require.resolve('../config/database'),
    require.resolve('../middleware/civicIdentity'),
    require.resolve('../middleware/politicalConsent'),
    require.resolve('../services/preferenceCooldownService'),
    require.resolve('../routes/referendum-vote'),
    require.resolve('../routes/referendum')
  ];
  const previous=new Map(paths.map(p=>[p,require.cache[p]]));
  let server;
  let blocked=null;
  const opinionUpdates=[];
  const pool={
    query:(...args)=>real.query(...args),
    async connect(){
      const c=await real.connect();
      return {
        async query(sql,params){
          const normalized=sourceSql(sql);
          if(normalized.startsWith('UPDATE public.opinioni_risposte')){
            opinionUpdates.push({sql:normalized,params:[...(params||[])]});
          }
          // The second HTTP request must reach its competing DB statement
          // BEFORE the first transaction is released. Otherwise a green
          // result could merely prove sequential requests.
          if(blocked && !blocked.contenderSeen && (
            (blocked.phase==='save' && normalized.startsWith('UPDATE public.users SET political_opinions_consent = false')) ||
            (blocked.phase==='revoke' && (blocked.requireCanonicalLock
              ? /^SELECT id FROM public\.users WHERE id = \$1 FOR UPDATE$/
              : /^SELECT id FROM (?:public\.)?users WHERE id = \$1 FOR UPDATE$/).test(normalized))
          )){
            blocked.contenderSeen=true;
            blocked.contender.resolve();
          }
          const answer=await c.query(sql,params);
          if(blocked && !blocked.consumed && (
            (blocked.phase==='save' && (blocked.requireCanonicalLock
              ? /^SELECT id FROM public\.users WHERE id = \$1 FOR UPDATE$/
              : /^SELECT id FROM (?:public\.)?users WHERE id = \$1 FOR UPDATE$/).test(normalized)) ||
            (blocked.phase==='revoke' && normalized.startsWith('UPDATE public.users SET political_opinions_consent = false'))
          )){
            blocked.consumed=true;
            blocked.locked.resolve();
            await timeout(blocked.resume.promise);
          }
          return answer;
        },
        release(destroy){ c.release(destroy); }
      };
    }
  };
  try{
    const v=(await real.query("SELECT current_database() db,current_setting('server_version_num')::int v")).rows[0];
    assert.equal(v.db,DB);
    assert.equal(Math.floor(v.v/10000),17);
    await real.query('CREATE TABLE users(id uuid PRIMARY KEY, political_opinions_consent boolean NOT NULL, political_opinions_consent_timestamp timestamptz, political_opinions_consent_ip_address text, political_opinions_consent_user_agent text, updated_at timestamptz DEFAULT now())');
    await real.query('CREATE TABLE user_consents(user_id uuid PRIMARY KEY,political_opinions_consent boolean,political_opinions_consent_timestamp timestamptz,political_opinions_consent_ip_address text,political_opinions_consent_user_agent text,updated_at timestamptz DEFAULT now())');
    await real.query('CREATE TABLE opinioni_risposte(user_id uuid PRIMARY KEY,energia_nucleare text,sperimentazione_animale text,caccia text)');
    await real.query('CREATE TABLE civic_ballots(id uuid PRIMARY KEY,status text,opens_at timestamptz,closes_at timestamptz)');
    await real.query('CREATE TABLE civic_ballot_positions(civic_ballot_id uuid NOT NULL,user_id uuid NOT NULL,choice text NOT NULL,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),PRIMARY KEY(civic_ballot_id,user_id))');
    await real.query("CREATE TABLE voti_referendum_abrogativi(userid uuid NOT NULL,referendum_id text NOT NULL CHECK (referendum_id <> 'invalid'),PRIMARY KEY(userid,referendum_id))");
    await real.query("INSERT INTO civic_ballots(id,status,opens_at,closes_at) VALUES('00000000-0000-4000-8000-000000000126','scheduled',NOW()+interval '10 days',NOW()+interval '11 days')");
    await real.query('CREATE TABLE opinioni_domande(id text PRIMARY KEY,text text)');
    await real.query("INSERT INTO opinioni_domande VALUES('energia_nucleare','Synthetic energy opinion')");
    await real.query('INSERT INTO users(id,political_opinions_consent) VALUES($1,true)',[ID]);
    await real.query('INSERT INTO user_consents(user_id,political_opinions_consent) VALUES($1,true)',[ID]);

    const [auth,audit,ledger,service,saveRoute,revokeRoute,adminRoute]=paths;
    require.cache[auth]={id:auth,filename:auth,loaded:true,exports:{
      pool,
      verifyToken:(req,res,next)=>{
        if(req.get('authorization')!=='Bearer synthetic-test'){
          return res.status(401).json({success:false});
        }
        req.userId=ID;req.user={id:ID,isPolitician:false,isCandidate:false};
        next();
      },
      requireAdmin:(_r,_res,next)=>next() // CI-only fake administrator
    }};
    require.cache[audit]={id:audit,filename:audit,loaded:true,exports:{
      logAction:async()=>{}
    }};
    require.cache[ledger]={id:ledger,filename:ledger,loaded:true,exports:{
      EVENT_TYPES:{POLITICAL_CONSENT_GRANTED:'political_consent_granted',
        POLITICAL_CONSENT_REVOKED:'political_consent_revoked'},
      recordEvent:async()=>{},
      async deleteByAnyColumn(db,table,_cols,user){
        if(table==='opinioni_risposte'){
          const r=await db.query('DELETE FROM public.opinioni_risposte WHERE user_id=$1',[user]);
          return r.rowCount;
        }
        if(table==='civic_ballot_positions'){
          const r=await db.query('DELETE FROM civic_ballot_positions WHERE user_id=$1',[user]);
          return r.rowCount;
        }
        if(table==='voti_referendum_abrogativi'){
          const r=await db.query('DELETE FROM voti_referendum_abrogativi WHERE userid=$1',[user]);
          return r.rowCount;
        }
        return 0;
      },
      tableHasColumn:async()=>false,
      quoteIdentifier:id=>'"'+String(id).replace(/"/g,'""')+'"'
    }};
    const [, , , , , , , dbConfig, civicIdentity, consentMiddleware, cooldownService, referendumVoteRoute, legacyReferendumRoute] = paths;
    require.cache[dbConfig]={id:dbConfig,filename:dbConfig,loaded:true,exports:{getPool:()=>pool}};
    require.cache[civicIdentity]={id:civicIdentity,filename:civicIdentity,loaded:true,exports:{
      requireVerifiedCivicIdentity:(_req,_res,next)=>next()
    }};
    require.cache[cooldownService]={id:cooldownService,filename:cooldownService,loaded:true,exports:{
      getPreferenceCooldown:async()=>({isBlocked:false,unlockDate:null}),
      assertPreferenceChangeAllowed:async()=>{},
      recordPreferenceChange:async()=>{},
      sendCooldownError:()=>false
    }};
    for(const p of [service,saveRoute,revokeRoute,adminRoute,consentMiddleware,referendumVoteRoute,legacyReferendumRoute])delete require.cache[p];

    const app=express();app.disable('x-powered-by');app.use(express.json());
    app.use('/api/opinioni',require(saveRoute));
    app.use('/api/user/political-opinions-consent',require(revokeRoute));
    app.use('/api/users',require(adminRoute));
    app.use('/api/referendum/vote-real',require(referendumVoteRoute));
    app.use('/api/referendum',require(legacyReferendumRoute));
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    const base='http://127.0.0.1:'+server.address().port;
    const request=(path,method,body)=>fetch(base+path,{
      method,headers:{authorization:'Bearer synthetic-test','content-type':'application/json'},
      ...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(12000)
    });
    const save=()=>request('/api/opinioni/salva','POST',{opinioni:{energia_nucleare:'f'}});
    const revoke=()=>request('/api/user/political-opinions-consent/revoke','PUT');
    const admin=()=>request('/api/users/'+ID+'/opinioni','PUT',{opinioni:{energia_nucleare:'f'}});
    const referendumVote=()=>request('/api/referendum/vote-real/00000000-0000-4000-8000-000000000126/choice','POST',{choice:'YES'});
    const referendumCount=async()=>Number((await real.query('SELECT COUNT(*)::int AS n FROM civic_ballot_positions WHERE user_id=$1',[ID])).rows[0].n);
    const legacyVote=()=>request('/api/referendum/abrogativi/vota','POST',{voti:['ref-valid']});
    const legacyVoteInvalid=()=>request('/api/referendum/abrogativi/vota','POST',{voti:['ref-new','invalid']});
    const legacyVotes=async()=> (await real.query('SELECT referendum_id FROM voti_referendum_abrogativi WHERE userid=$1 ORDER BY referendum_id',[ID])).rows.map(r=>r.referendum_id);
    const reset=async()=>{
      await real.query('UPDATE users SET political_opinions_consent=true WHERE id=$1',[ID]);
      await real.query('UPDATE user_consents SET political_opinions_consent=true WHERE user_id=$1',[ID]);
      await real.query('DELETE FROM opinioni_risposte WHERE user_id=$1',[ID]);
      await real.query('DELETE FROM civic_ballot_positions WHERE user_id=$1',[ID]);
      await real.query('DELETE FROM voti_referendum_abrogativi WHERE userid=$1',[ID]);
    };
    const inspect=async()=>{
      const rows=await real.query('SELECT u.political_opinions_consent consent, uc.political_opinions_consent override, orr.energia_nucleare answer FROM users u JOIN user_consents uc ON uc.user_id=u.id LEFT JOIN opinioni_risposte orr ON orr.user_id=u.id WHERE u.id=$1',[ID]);
      return rows.rows[0];
    };

    // SAVE first: revocation must WAIT for save's row lock, then delete
    // the newly written answer atomically before returning HTTP 200.
    blocked={phase:'save',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const saveFirst=save();
    await timeout(blocked.locked.promise);
    const revokeSecond=revoke();
    await timeout(blocked.contender.promise);
    // The revocation has reached the conflicting database UPDATE while
    // the opinion-save transaction still owns the users row lock.
    blocked.resume.resolve();
    assert.equal((await timeout(saveFirst)).status,200);
    assert.equal((await timeout(revokeSecond)).status,200);
    assert.deepEqual(await inspect(),{consent:false,override:false,answer:null});

    // REVOKE first: hold the users row lock, then save must wait, notice
    // consent false, issue rollback and refuse to create a new answer.
    await reset();
    blocked={phase:'revoke',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const revokeFirst=revoke();
    await timeout(blocked.locked.promise);
    const saveSecond=save();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(revokeFirst)).status,200);
    const saveResponse=await timeout(saveSecond);
    assert.equal(saveResponse.status,403);
    assert.equal((await saveResponse.json()).consent_required,true);
    assert.deepEqual(await inspect(),{consent:false,override:false,answer:null});

    // A normal request should still be allowed after a new explicit grant.
    await reset();
    blocked=null;
    assert.equal((await save()).status,200);
    assert.deepEqual(await inspect(),{consent:true,override:true,answer:'f'});

    // Real HTTP contract of the optimized route, including the legacy mobile
    // payload: accepted count is NOT the number of database columns rewritten.
    const payload={energia_nucleare:'f',sperimentazione_animale:'c',caccia:'i'};
    opinionUpdates.length=0;
    const firstFields=await request('/api/opinioni/salva','POST',{opinioni:payload});
    assert.equal(firstFields.status,200);
    assert.equal((await firstFields.json()).savedCount,3);
    assert.equal(opinionUpdates.length,1,'initial NULL fields must be updated together');
    assert.match(opinionUpdates[0].sql,/SET "sperimentazione_animale" = \$1, "caccia" = \$2 WHERE user_id = \$3/);
    opinionUpdates.length=0;
    const identical=await request('/api/opinioni/salva','POST',{opinioni:payload});
    assert.equal(identical.status,200);
    const identicalBody=await identical.json();
    assert.equal(identicalBody.savedCount,3,'unchanged answers remain accepted');
    assert.equal(identicalBody.errorCount,0);
    assert.equal(opinionUpdates.length,0,'no-op must skip all opinion UPDATE statements');
    opinionUpdates.length=0;
    const changedFields=await request('/api/opinioni/salva','POST',{
      opinioni:{...payload,sperimentazione_animale:'f'}
    });
    assert.equal(changedFields.status,200);
    assert.equal((await changedFields.json()).savedCount,3);
    assert.equal(opinionUpdates.length,1);
    assert.match(opinionUpdates[0].sql,/SET "sperimentazione_animale" = \$1 WHERE user_id = \$2/);
    assert.deepEqual(opinionUpdates[0].params,['f',ID]);
    const changedRow=(await real.query(
      'SELECT energia_nucleare,sperimentazione_animale,caccia FROM opinioni_risposte WHERE user_id=$1',[ID]
    )).rows[0];
    assert.deepEqual(changedRow,{energia_nucleare:'f',sperimentazione_animale:'f',caccia:'i'});

    // Older clients can still submit the answers directly in the request body
    // with Italian answer labels. Do not make the new delta-write path require
    // a new Android release or an extra wrapper field.
    opinionUpdates.length=0;
    const legacyBody=await request('/api/opinioni/salva','POST',{energia_nucleare:'Contrario'});
    assert.equal(legacyBody.status,200);
    assert.equal((await legacyBody.json()).savedCount,1);
    assert.equal(opinionUpdates.length,1);
    assert.match(opinionUpdates[0].sql,/SET "energia_nucleare" = \$1 WHERE user_id = \$2/);
    assert.deepEqual(opinionUpdates[0].params,['c',ID]);

    // Revocation and a repeated, no-op save must still serialize. Skipping
    // an UPDATE must never skip the users-row consent lock.
    await reset();
    blocked=null;
    assert.equal((await save()).status,200);
    opinionUpdates.length=0;
    blocked={phase:'save',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const noOpBeforeRevoke=save();
    await timeout(blocked.locked.promise);
    const revokeAfterNoOp=revoke();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    const noOpResult=await timeout(noOpBeforeRevoke);
    assert.equal(noOpResult.status,200);
    assert.equal((await noOpResult.json()).savedCount,1);
    assert.equal((await timeout(revokeAfterNoOp)).status,200);
    assert.equal(opinionUpdates.length,0,'no-op save must not create an UPDATE');
    assert.deepEqual(await inspect(),{consent:false,override:false,answer:null});

    await reset();
    blocked=null;
    assert.equal((await save()).status,200);
    blocked={phase:'revoke',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const revokeBeforeNoOp=revoke();
    await timeout(blocked.locked.promise);
    const noOpAfterRevoke=save();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(revokeBeforeNoOp)).status,200);
    const deniedNoOp=await timeout(noOpAfterRevoke);
    assert.equal(deniedNoOp.status,403);
    assert.equal((await deniedNoOp.json()).consent_required,true);
    assert.deepEqual(await inspect(),{consent:false,override:false,answer:null});

    // The admin route must observe the same serialization guarantees.
    await reset();
    blocked={phase:'save',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const adminFirst=admin();
    await timeout(blocked.locked.promise);
    const afterAdminRevoke=revoke();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(adminFirst)).status,200);
    assert.equal((await timeout(afterAdminRevoke)).status,200);
    assert.deepEqual(await inspect(),{consent:false,override:false,answer:null});

    await reset();
    blocked={phase:'revoke',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const revokeBeforeAdmin=revoke();
    await timeout(blocked.locked.promise);
    const adminAfterRevoke=admin();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(revokeBeforeAdmin)).status,200);
    const adminDenied=await timeout(adminAfterRevoke);
    assert.equal(adminDenied.status,403);
    assert.equal((await adminDenied.json()).consent_required,true);
    assert.deepEqual(await inspect(),{consent:false,override:false,answer:null});

    // Real referendum forecast positions must serialize with the same revoke.
    // A successful vote followed by revocation must be deleted atomically.
    await reset();
    blocked={phase:'save',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const referendumFirst=referendumVote();
    await timeout(blocked.locked.promise);
    const revokeAfterReferendum=revoke();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(referendumFirst)).status,200);
    assert.equal((await timeout(revokeAfterReferendum)).status,200);
    assert.equal(await referendumCount(),0);

    // A revocation already holding the user row lock must block and reject
    // a subsequent vote, even if middleware saw an earlier active consent.
    await reset();
    blocked={phase:'revoke',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const revokeBeforeReferendum=revoke();
    await timeout(blocked.locked.promise);
    const referendumAfterRevoke=referendumVote();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(revokeBeforeReferendum)).status,200);
    const deniedReferendum=await timeout(referendumAfterRevoke);
    assert.equal(deniedReferendum.status,403);
    assert.equal((await deniedReferendum.json()).consent_required,true);
    assert.equal(await referendumCount(),0);

    await reset();
    blocked=null;
    assert.equal((await referendumVote()).status,200);
    assert.equal(await referendumCount(),1);

    // The still-reachable legacy referendum preference endpoint must obey
    // the same user-row lock and consent rule as modern referendum forecasts.
    await reset();
    blocked={phase:'save',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const legacyFirst=legacyVote();
    await timeout(blocked.locked.promise);
    const revokeAfterLegacy=revoke();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(legacyFirst)).status,200);
    assert.equal((await timeout(revokeAfterLegacy)).status,200);
    assert.deepEqual(await legacyVotes(),[]);

    await reset();
    blocked={phase:'revoke',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false};
    const revokeBeforeLegacy=revoke();
    await timeout(blocked.locked.promise);
    const legacyAfterRevoke=legacyVote();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(revokeBeforeLegacy)).status,200);
    const deniedLegacy=await timeout(legacyAfterRevoke);
    assert.equal(deniedLegacy.status,403);
    assert.equal((await deniedLegacy.json()).consent_required,true);
    assert.deepEqual(await legacyVotes(),[]);

    await reset();
    blocked=null;
    assert.equal((await legacyVote()).status,200);
    assert.deepEqual(await legacyVotes(),['ref-valid']);

    // A failed replacement must not erase a previously committed preference.
    const invalidLegacy=await legacyVoteInvalid();
    assert.equal(invalidLegacy.status,500);
    assert.deepEqual(await legacyVotes(),['ref-valid']);


    // Real POST/PUT/GET regression on borrowed PG17 connections with pg_temp
    // shadows. The ledger writer now uses public tables, so the consent
    // flags MUST be updated/read in public as well. No application data:
    // only this disposable localhost synthetic CI database is involved.
    await reset();
    blocked=null;
    const grant=()=>request('/api/user/political-opinions-consent','POST',{consent:true});
    const consentRead=()=>request('/api/user/political-opinions-consent','GET');
    const borrowed=await Promise.all([real.connect(),real.connect(),real.connect()]);
    try {
      for (const c of borrowed) {
        await c.query('CREATE TEMP TABLE users (LIKE public.users INCLUDING DEFAULTS)');
        await c.query('CREATE TEMP TABLE user_consents (LIKE public.user_consents INCLUDING DEFAULTS)');
        await c.query('CREATE TEMP TABLE opinioni_risposte (LIKE public.opinioni_risposte INCLUDING DEFAULTS)');
        await c.query("INSERT INTO pg_temp.opinioni_risposte(user_id,energia_nucleare) VALUES($1,'i')",[ID]);
        await c.query('INSERT INTO pg_temp.users SELECT * FROM public.users WHERE id=$1',[ID]);
        await c.query('INSERT INTO pg_temp.user_consents SELECT * FROM public.user_consents WHERE user_id=$1',[ID]);
        await c.query('SET search_path TO pg_temp, public');
      }
    } finally { for (const c of borrowed) c.release(); }
    // Keep the real public.users row locked by a revoke while an opinion
    // save starts on another pooled connection. All connections also have
    // pg_temp.users: an unqualified FOR UPDATE would lock the wrong row.
    blocked={phase:'revoke',locked:gate(),resume:gate(),contender:gate(),consumed:false,contenderSeen:false,requireCanonicalLock:true};
    const publicRevokeFirst=revoke();
    await timeout(blocked.locked.promise);
    const publicSaveSecond=save();
    await timeout(blocked.contender.promise);
    blocked.resume.resolve();
    assert.equal((await timeout(publicRevokeFirst)).status,200);
    const deniedShadowOpinion=await timeout(publicSaveSecond);
    assert.equal(deniedShadowOpinion.status,403,
      'opinion save after public revoke must not succeed on a shadow row');
    assert.equal((await deniedShadowOpinion.json()).consent_required,true);
    assert.equal(Number((await real.query(
      'SELECT COUNT(*)::int AS n FROM public.opinioni_risposte WHERE user_id=$1',[ID]
    )).rows[0].n),0,'revoke must leave no canonical opinion choices');
    blocked=null;
    const publicFlags=async()=>{
      const x=await real.query(
        'SELECT u.political_opinions_consent AS base, ' +
        'uc.political_opinions_consent AS override ' +
        'FROM public.users u JOIN public.user_consents uc ON uc.user_id=u.id ' +
        'WHERE u.id=$1',[ID]);
      assert.equal(x.rows.length,1);
      return x.rows[0];
    };
    // Opposing public/shadow values prove GET resolves the canonical tables.
    await real.query('UPDATE public.users SET political_opinions_consent=false WHERE id=$1',[ID]);
    await real.query('UPDATE public.user_consents SET political_opinions_consent=false WHERE user_id=$1',[ID]);
    const shadowForGet=await Promise.all([real.connect(),real.connect(),real.connect()]);
    try {
      for (const c of shadowForGet) {
        await c.query('UPDATE pg_temp.users SET political_opinions_consent=true WHERE id=$1',[ID]);
        await c.query('UPDATE pg_temp.user_consents SET political_opinions_consent=true WHERE user_id=$1',[ID]);
      }
    } finally { for (const c of shadowForGet) c.release(); }
    const beforeGrant=await consentRead();
    assert.equal(beforeGrant.status,200);
    assert.equal((await beforeGrant.json()).consent.granted,false,
      'GET must not accept a fake granted consent in pg_temp');

    const shadowBeforeGrant=await Promise.all([real.connect(),real.connect(),real.connect()]);
    try {
      for (const c of shadowBeforeGrant) {
        await c.query('UPDATE pg_temp.users SET political_opinions_consent=false WHERE id=$1',[ID]);
        await c.query('UPDATE pg_temp.user_consents SET political_opinions_consent=false WHERE user_id=$1',[ID]);
      }
    } finally { for (const c of shadowBeforeGrant) c.release(); }
    assert.equal((await grant()).status,200,'grant must update canonical public users');
    assert.deepEqual(await publicFlags(),{base:true,override:true});
    assert.equal((await save()).status,200,
      'opinion save must target canonical responses despite temporary shadow');
    const canonicalAnswer=await real.query(
      'SELECT energia_nucleare FROM public.opinioni_risposte WHERE user_id=$1',[ID]);
    assert.equal(canonicalAnswer.rows[0]?.energia_nucleare,'f');
    const shadowAnswers=await Promise.all([real.connect(),real.connect(),real.connect()]);
    try {
      for (const c of shadowAnswers) {
        const saved=await c.query(
          'SELECT energia_nucleare FROM pg_temp.opinioni_risposte WHERE user_id=$1',[ID]);
        assert.equal(saved.rows[0]?.energia_nucleare,'i',
          'an opinion write must not update shadow answer rows');
      }
    } finally { for (const c of shadowAnswers) c.release(); }
    const afterGrant=await consentRead();
    assert.equal(afterGrant.status,200);
    assert.equal((await afterGrant.json()).consent.granted,true);
    const checkGrantShadows=await Promise.all([real.connect(),real.connect(),real.connect()]);
    try {
      for (const c of checkGrantShadows) {
        const u=await c.query('SELECT political_opinions_consent FROM pg_temp.users WHERE id=$1',[ID]);
        const uc=await c.query('SELECT political_opinions_consent FROM pg_temp.user_consents WHERE user_id=$1',[ID]);
        assert.equal(u.rows[0].political_opinions_consent,false,
          'grant must never modify temporary users');
        assert.equal(uc.rows[0].political_opinions_consent,false,
          'grant must never modify temporary consents');
        await c.query('UPDATE pg_temp.users SET political_opinions_consent=true WHERE id=$1',[ID]);
        await c.query('UPDATE pg_temp.user_consents SET political_opinions_consent=true WHERE user_id=$1',[ID]);
      }
    } finally { for (const c of checkGrantShadows) c.release(); }
    assert.equal((await revoke()).status,200,'revoke must update canonical public users');
    assert.deepEqual(await publicFlags(),{base:false,override:false});
    const afterRevoke=await consentRead();
    assert.equal(afterRevoke.status,200);
    assert.equal((await afterRevoke.json()).consent.granted,false);
    const finalShadows=await Promise.all([real.connect(),real.connect(),real.connect()]);
    try {
      for (const c of finalShadows) {
        const u=await c.query('SELECT political_opinions_consent FROM pg_temp.users WHERE id=$1',[ID]);
        const uc=await c.query('SELECT political_opinions_consent FROM pg_temp.user_consents WHERE user_id=$1',[ID]);
        assert.equal(u.rows[0].political_opinions_consent,true,
          'revoke must never modify temporary users');
        assert.equal(uc.rows[0].political_opinions_consent,true,
          'revoke must never modify temporary consents');
        await c.query('RESET search_path');
        await c.query('DROP TABLE pg_temp.opinioni_risposte');
        await c.query('DROP TABLE pg_temp.user_consents');
        await c.query('DROP TABLE pg_temp.users');
      }
    } finally { for (const c of finalShadows) c.release(); }

    console.log('POLITICAL_OPINION_ROW_LOCK_AND_SHADOW_PG17_PASS');
    console.log('POLITICAL_CONSENT_PUBLIC_SCHEMA_SHADOW_PG17_PASS');
    console.log('POLITICAL_CONSENT_SAVE_REVOKE_REAL_PG17_PASS');
    console.log('POLITICAL_CONSENT_SAVE_REVOKE_RESULT_JSON='+JSON.stringify({
      postgres:17,fixture:'synthetic-only',cases:['save-before-revoke','revoke-before-save','grant-and-save','http-multi-new-fields','http-noop-delta','http-single-column-update','http-legacy-flat-payload','noop-before-revoke','revoke-before-noop','admin-before-revoke','revoke-before-admin','referendum-before-revoke','revoke-before-referendum','referendum-with-active-consent','legacy-referendum-before-revoke','revoke-before-legacy-referendum','legacy-referendum-with-active-consent','legacy-referendum-replacement-rollback'],
      postRevocationPersistedAnswers:0, unauthorizedWrites:0,
      isolated:true,productionUntouched:true
    }));
  }finally{
    if(server)await new Promise(resolve=>server.close(resolve));
    for(const [p,original] of previous){
      if(original)require.cache[p]=original;else delete require.cache[p];
    }
    await real.end();
  }
}
main().catch(e=>{console.error('SYNTHETIC_CONSENT_RACE_FAIL',e);process.exitCode=1;});
