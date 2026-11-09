'use strict';
// Production authorization guard tested with synthetic clients only.
// Never needs a database, JWT, external URL, or production environment.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { isNominationWriteEnabled, isGraziaNominationWriteEnabled } = require('../utils/thirdPartyNominationGate');

const dir = path.resolve(__dirname,'../routes');
const UUID = '22222222-2222-4222-8222-222222222222';

function harness(which,enabled=false,graziaEnabled=enabled) {
  const route = fs.readFileSync(path.join(dir,which==='generic'?'subject-proposals.js':'grazia.js'),'utf8');
  const post = new Map();
  const state = {connects:0,queries:0};
  const pool = {
    async connect() {
      state.connects++;
      return {
        async query(sql) {
          state.queries++;
          if (String(sql).includes('WHERE id=$1 AND status')) return {rows:[]};
          if (String(sql).includes('FROM richieste_grazia WHERE id = $1')) return {rows:[]};
          if (String(sql).includes("FROM subject_proposals WHERE id=$1")) return {rows:[]};
          return {rows:[],rowCount:0};
        },
        release() {},
      };
    },
    async query() {state.queries++;return {rows:[],rowCount:0};},
  };
  const pass = (_req,_res,next)=>next?.();
  const stubs = {
    express:{Router:()=>({use:()=>{},get:()=>{},post:(name,...args)=>post.set(name,args.at(-1))})},
    crypto:{randomUUID:()=>UUID},
    '../config/database':{getPool:()=>pool},
    '../middleware/auth':{verifyToken:pass,requireAdmin:pass,pool},
    '../middleware/politicalConsent':{requirePoliticalConsent:pass},
    '../middleware/civicIdentity':{requireVerifiedCivicIdentity:pass},
    '../middleware/validation':{validateInput:()=>pass},
    '../utils/recognitionEvidence':{validateEvidenceUrl:()=> 'https://example.org/fonte'},
    '../services/publicApprovedSubjectPage':{readApprovedPage:async()=>({data:[],next_cursor:null})},
    // Keep the offline mock in sync with the Grazia router imports.
    '../services/politicalConsentService':{getPoliticalConsentState:async()=>({exists:true,granted:true})},
    '../services/preferenceCooldownService':{
      getPreferenceCooldown:async()=>({isBlocked:false}),
      assertPreferenceChangeAllowed:async()=>{},
      recordPreferenceChange:async()=>{},
      sendCooldownError:()=>false,
    },
    '../utils/thirdPartyNominationGate':{
      isNominationWriteEnabled:()=>enabled,
      isGraziaNominationWriteEnabled:()=>enabled && graziaEnabled,
      rejectUnavailableNomination:(res)=>{
        res.set('Cache-Control','private, no-store');
        return res.status(503).json({success:false,error:'PROPOSTE_NON_DISPONIBILI'});
      },
    },
  };
  vm.runInNewContext(route,{
    module:{exports:{}},
    require:name=>{
      if (!(name in stubs))throw new Error('Unexpected dependency '+name);
      return stubs[name];
    },
    Buffer,URL,Set,console,process:{env:{NODE_ENV:'production'}},
  },{filename:which});
  const response = ()=>({
    statusCode:200,headers:{},body:null,
    status(code){this.statusCode=code;return this},
    set(name,value){this.headers[name]=value;return this},
    json(body){this.body=body;return this},
  });
  return {post,state,response};
}
test('third-party writes fail closed in every runtime without exact explicit opt-in',()=>{
  for (const nodeEnv of [undefined,'','production','staging','preview','development','test']){
    for (const value of [undefined,'','false','TRUE','1','yes',' true','true ']){
      assert.equal(isNominationWriteEnabled({
        NODE_ENV:nodeEnv,DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED:value
      }),false,'mode '+String(nodeEnv)+', value '+String(value));
    }
    assert.equal(isNominationWriteEnabled({
      NODE_ENV:nodeEnv,DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED:'true'
    }),true,'explicit operator opt-in must be exact');
  }
});
test('CI and even a synthetic localhost fixture cannot silently override the gate',()=>{
  const mode={
    CIVIC_TEST_MODE:'isolated-synthetic',
    CIVIC_TEST_DATABASE_URL:'postgres://demos_ci:synthetic_only@127.0.0.1:5432/demos_civic_ci'
  };
  for (const nodeEnv of [undefined,'test','development','staging','production']){
    assert.equal(isNominationWriteEnabled({...mode,NODE_ENV:nodeEnv}),false,
      'synthetic mode must not bypass explicit operator switch');
    assert.equal(isNominationWriteEnabled({...mode,NODE_ENV:nodeEnv,
      DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED:'true'}),true);
  }
  assert.equal(isNominationWriteEnabled({...mode,CIVIC_TEST_DATABASE_URL:
    'postgres://demos_ci:synthetic_only@aws-1-eu-central-1.pooler.supabase.com:5432/demos_civic_ci'}),false);
});
test('Grazia requires a separate exact opt-in IN ADDITION to the global nomination gate',()=>{
  for(const nodeEnv of [undefined,'production','staging','preview','development','test']){
    for(const general of [undefined,'','false','TRUE','1','true']){
      for(const grazia of [undefined,'','false','TRUE','1',' true','true ','true']){
        const env={
          NODE_ENV:nodeEnv,
          DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED:general,
          DEMOS_GRAZIA_NOMINATIONS_ENABLED:grazia,
          CIVIC_TEST_MODE:'isolated-synthetic'
        };
        assert.equal(isGraziaNominationWriteEnabled(env),
          general==='true' && grazia==='true',
          'two independent exact approvals: '+String(nodeEnv)+', '+String(general)+', '+String(grazia));
        if(grazia==='true' && general!=='true')
          assert.equal(isGraziaNominationWriteEnabled(env),false);
      }
    }
  }
});

test('global enable permits generic proposal while Grazia remains closed before any SQL',async()=>{
  const generic=harness('generic',true,false);
  const genericResponse=generic.response();
  await generic.post.get('/')(
    {user:{id:UUID},body:{category:'attivisti',title:'Persona sintetica',source_url:'https://example.org/fonte'}},
    genericResponse
  );
  assert.notEqual(genericResponse.statusCode,503,'Grazia embargo must not block separately cleared categories');
  assert.ok(generic.state.connects>=1);

  const grazia=harness('grazia',true,false);
  const source={user:{id:UUID},body:{nome:'Persona sintetica',urlProva:'https://example.org/fonte'}};
  const submit=grazia.response();
  await grazia.post.get('/')(source,submit);
  assert.equal(submit.statusCode,503);
  assert.equal(submit.body.error,'PROPOSTE_NON_DISPONIBILI');
  assert.match(submit.headers['Cache-Control'],/no-store/);
  assert.deepEqual(grazia.state,{connects:0,queries:0});
  const approve=grazia.response();
  await grazia.post.get('/richiesta/:id/:action')(
    {params:{id:UUID,action:'accetta'},user:{id:UUID},body:{}},approve
  );
  assert.equal(approve.statusCode,503);
  assert.deepEqual(grazia.state,{connects:0,queries:0});
  const reject=grazia.response();
  await grazia.post.get('/richiesta/:id/:action')(
    {params:{id:UUID,action:'rifiuta'},user:{id:UUID},body:{}},reject
  );
  assert.notEqual(reject.statusCode,503,'rejection of existing requests stays operational');
  assert.ok(grazia.state.connects>=1);
});

test('both opt-ins preserve authorized Grazia submission path',async()=>{
  const app=harness('grazia',true,true);
  const res=app.response();
  await app.post.get('/')(
    {user:{id:UUID},body:{nome:'Persona sintetica',urlProva:'https://example.org/fonte'}},res
  );
  assert.notEqual(res.statusCode,503);
  assert.ok(app.state.connects>=1);
});

for (const which of ['generic','grazia']) {
  test(which+' production submit is rejected before connection or notification',async()=>{
    const app=harness(which,false);
    const res=app.response();
    const req=which==='generic'
      ? {user:{id:UUID},body:{category:'attivisti',title:'Persona sintetica',source_url:'https://example.org/fonte'}}
      : {user:{id:UUID},body:{nome:'Persona sintetica',urlProva:'https://example.org/fonte'}};
    await app.post.get('/')(req,res);
    assert.equal(res.statusCode,503);
    assert.equal(res.body?.error,'PROPOSTE_NON_DISPONIBILI');
    assert.match(res.headers['Cache-Control'],/no-store/);
    assert.deepEqual(app.state,{connects:0,queries:0});
  });
  test(which+' production approval is blocked, but rejection remains available',async()=>{
    const app=harness(which,false);
    const path=which==='generic'?'/admin/:id/decision':'/richiesta/:id/:action';
    const res=app.response();
    const req=which==='generic'
      ? {user:{id:UUID},params:{id:UUID},body:{decision:'approve'}}
      : {user:{id:UUID},params:{id:UUID,action:'accetta'},body:{}};
    await app.post.get(path)(req,res);
    assert.equal(res.statusCode,503);
    assert.deepEqual(app.state,{connects:0,queries:0});
    const reject=app.response();
    if (which==='generic')req.body={decision:'reject'};
    else req.params.action='rifiuta';
    await app.post.get(path)(req,reject);
    assert.notEqual(reject.statusCode,503,'Admin must still be able to reject existing proposals');
    assert.ok(app.state.connects>=1,'rejection reaches the existing moderation handler');
  });
  test(which+' explicit activation preserves existing authorized write path',async()=>{
    const app=harness(which,true);
    const res=app.response();
    const req=which==='generic'
      ? {user:{id:UUID},body:{category:'attivisti',title:'Persona sintetica',source_url:'https://example.org/fonte'}}
      : {user:{id:UUID},body:{nome:'Persona sintetica',urlProva:'https://example.org/fonte'}};
    await app.post.get('/')(req,res);
    assert.notEqual(res.statusCode,503);
    assert.ok(app.state.connects>=1);
  });
}
