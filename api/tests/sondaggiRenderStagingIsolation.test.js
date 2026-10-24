'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {spawn} = require('node:child_process');
const path = require('node:path');
const {
  eqToken,
  validStagingConfig,
  verifiedSupabaseCa,
  assertSafeRead,
  rewriteOnlySyntheticTables
} = require('../staging/op37_render_http_probe');

const entry=path.resolve(__dirname,'../staging/op37_render_http_probe.js');
const PORT=29137;
const SYNTHETIC_TEST_CA = `-----BEGIN CERTIFICATE-----
MIIBbzCCARWgAwIBAgIUGVTZNYEwdH1MFHBkensV3uplb78wCgYIKoZIzj0EAwIw
LTErMCkGA1UEAwwiU3ludGhldGljIFRlc3QgQ0EgLSBObyBSZWFsIEFjY2VzczAe
Fw0yNjEwMjIyMDUxNTNaFw0yNzEwMjQyMDUxNTNaMC0xKzApBgNVBAMMIlN5bnRo
ZXRpYyBUZXN0IENBIC0gTm8gUmVhbCBBY2Nlc3MwWTATBgcqhkjOPQIBBggqhkjO
PQMBBwNCAAT27Jo0SC/wso8TksSD3EWN7+nsnuRtDXmxE/J0eMBmcpYkyXKw63gU
l/uqggvTXSLNsum/yG7RPVTlyLS6D92voxMwETAPBgNVHRMBAf8EBTADAQH/MAoG
CCqGSM49BAMCA0gAMEUCIDy2HRpHw2uCZvVse0m2Vnv5n/q1AnBgrIV5zFCDsahh
AiEApwsYbeERLaiTeVuW95CzPvS12GxkVjKtdYeN9M6XOEg=
-----END CERTIFICATE-----`;
// A public, disposable CA with no corresponding private key in this repo.
// It exists only to exercise the strict parsing and trust-anchor guard.
const baseEnv=()=>({
  PATH:process.env.PATH||'/usr/bin:/bin',
  HOME:process.env.HOME||'/tmp',
  RENDER:'true',
  OP37_STAGING_HTTP_ONLY:'yes',
  OP37_STAGING_SETUP_ONLY:'yes',
  PORT:String(PORT),
  NODE_ENV:'test'
});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));

test('Render staging admits only Supabase EU IPv4 session-pooler and tenant-scoped custom reader',()=>{
 const good={
  RENDER:'true',OP37_STAGING_HTTP_ONLY:'yes',
  PGHOST:'aws-0-eu-central-1.pooler.supabase.com',
  PGPORT:'5432',PGDATABASE:'postgres',
  PGUSER:'op37_http_staging_reader.fkeayjzvtuvzesljhjbc',
  PGPASSWORD:'s'.repeat(64),OP37_HTTP_TOKEN:'t'.repeat(64),
  OP37_SUPABASE_CA_CERT:SYNTHETIC_TEST_CA
 };
 assert.equal(validStagingConfig(good),true);
 assert.equal(validStagingConfig({...good,
   PGHOST:'aws-7-eu-central-1.pooler.supabase.com'}),true);
 for(const change of [
  {PGHOST:'db.fkeayjzvtuvzesljhjbc.supabase.co'},  // IPv6-only direct
  {PGHOST:'aws-0-us-east-1.pooler.supabase.com'},
  {PGHOST:'aws-0-eu-central-1.pooler.supabase.com.evil.test'},
  {PGHOST:'aws-0-eu-central-1.pooler.supabase.com:5432'},
  {PGPORT:'6543'},  // enforce session, not transaction
  {PGUSER:'postgres'},
  {PGUSER:'op37_http_staging_reader'},
  {PGUSER:'op37_http_staging_reader.wxnblcqoyjqxktwkcqok'}, // production project ref
  {PGDATABASE:'production'},
  {PGPASSWORD:''},
  {PGPASSWORD:'too-short'},
  {OP37_HTTP_TOKEN:'too-short'},
  {OP37_SUPABASE_CA_CERT:''},
  {OP37_SUPABASE_CA_CERT:'not a certificate'},
  {OP37_SUPABASE_CA_CERT:SYNTHETIC_TEST_CA.replace('AQH/','AQH!')},
  {OP37_STAGING_HTTP_ONLY:'no'},
  {DATABASE_URL:'postgres://example.invalid'},
  {SUPABASE_SERVICE_ROLE_KEY:'forbidden'},
  {SUPABASE_URL:'https://example.invalid'}
 ]){
  assert.equal(validStagingConfig({...good,...change}),false,
    'Must fail closed: '+Object.keys(change)[0]);
 }
});

test('Supabase CA must be a valid non-expired CA PEM; literal newline encoding is allowed',()=>{
 assert.equal(verifiedSupabaseCa({OP37_SUPABASE_CA_CERT:SYNTHETIC_TEST_CA}),
  SYNTHETIC_TEST_CA);
 assert.equal(verifiedSupabaseCa({OP37_SUPABASE_CA_CERT:
  SYNTHETIC_TEST_CA.replace(/\n/g,'\\n')}),SYNTHETIC_TEST_CA);
 for(const ca of [undefined,null,'',"-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----"]){
  assert.equal(verifiedSupabaseCa({OP37_SUPABASE_CA_CERT:ca}),null);
 }
});

test('all ordinary opinion and metadata SQL is rewritten to the private synthetic namespace',()=>{
 const queries=[
  "SELECT id,text FROM opinioni_domande WHERE NOT ('da approvare'=ANY(gradi_opinione)) ORDER BY text",
  "SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'opinioni_risposte'",
  "SELECT v.opinion_id, COUNT(*) FROM opinioni_risposte orr JOIN users u ON u.id=orr.user_id LEFT JOIN user_consents uc ON uc.user_id=u.id CROSS JOIN LATERAL (VALUES ('synthetic_opinion_093',orr.\"synthetic_opinion_093\")) AS v(opinion_id,answer) GROUP BY v.opinion_id"
 ];
 for(const query of queries){
  const rewritten=rewriteOnlySyntheticTables(query);
  assert.doesNotMatch(rewritten,/\b(?:FROM|JOIN)\s+(?:users|user_consents|opinioni_domande|opinioni_risposte)\b/i);
  assert.doesNotMatch(rewritten,/table_schema\s*=\s*'public'/i);
 }
 assert.match(rewriteOnlySyntheticTables(queries[0]),/FROM op37_sondaggi_ci\.opinioni_domande/);
 assert.match(rewriteOnlySyntheticTables(queries[2]),/JOIN op37_sondaggi_ci\.users/);
});

test('out-of-scope SQL, mutating statements and unknown relation names are fail-closed',()=>{
 for(const query of [
  "SELECT * FROM public.users",
  "SELECT * FROM auth.users",
  "SELECT * FROM storage.objects",
  "SELECT * FROM a_different_table",
  "WITH foo AS (SELECT 1) DELETE FROM users",
  "UPDATE users SET account_type='PERSON'",
  "INSERT INTO users VALUES(1)",
  "SELECT * FROM users; DROP TABLE users",
  "COPY users TO STDOUT"
 ]){
  assert.throws(()=>rewriteOnlySyntheticTables(query),undefined,query);
 }
 assert.doesNotThrow(()=>assertSafeRead('SELECT 1'));
});

test('token check requires equality and does not accept absent or partial credentials',()=>{
 assert.equal(eqToken('some-long-synthetic-token','some-long-synthetic-token'),true);
 assert.equal(eqToken('some-long-synthetic-token','some-long-synthetic-toke'),false);
 assert.equal(eqToken(null,'some-long-synthetic-token'),false);
 assert.equal(eqToken('x','y'),false);
});

test('Render staging setup-only really exposes no SQL or survey route',async()=>{
 const child=spawn(process.execPath,[entry],{
  env:baseEnv(),stdio:['ignore','pipe','pipe']
 });
 let stdout='',stderr='',exited=false;
 child.stdout.on('data',x=>{stdout+=x.toString()});
 child.stderr.on('data',x=>{stderr+=x.toString()});
 child.once('exit',()=>{exited=true});
 try{
  let connected=false;
  for(let i=0;i<100;i++){
   if(exited)throw Error('Staging setup-only process exited: '+stderr);
   try{
    const response=await fetch('http://127.0.0.1:'+PORT+'/health',{
      signal:AbortSignal.timeout(350)
    });
    assert.equal(response.status,503);
    const j=await response.json();
    assert.equal(j.ready,false);
    assert.equal(j.reason,'staging_credential_not_configured');
    connected=true;break;
   }catch(e){
    if(e.code==='ERR_ASSERTION'||e.name==='AssertionError')throw e;
    await delay(70);
   }
  }
  assert.equal(connected,true,'Setup-only server did not listen');
  const root=await fetch('http://127.0.0.1:'+PORT+'/');
  assert.equal(root.status,200);
  const overview=await root.json();
  assert.equal(overview.databaseConnected,false);
  assert.equal(overview.productionConnected,false);
  assert.equal(overview.mode,'setup_required');
  for(const route of ['/benchmark/summary','/api/sondaggi',
    '/api/sondaggi/toscana','/api/sondaggi/toscana/pisa',
    '/api/sondaggi/toscana/pisa/pisa','/api/users']){
    const resp=await fetch('http://127.0.0.1:'+PORT+route);
    assert.equal(resp.status,route==='/benchmark/summary'?503:404,route);
  }
  assert.match(stdout,/OP37_RENDER_SETUP_ONLY_NO_DATABASE/);
  assert.equal(stderr,'');
 }finally{
  child.kill('SIGTERM');
  if(!exited)await new Promise(resolve=>child.once('exit',resolve));
 }
});

async function expectReject(env,phrase){
 const child=spawn(process.execPath,[entry],{
  env,stdio:['ignore','pipe','pipe']
 });
 let stderr='';
 child.stderr.on('data',x=>{stderr+=x.toString()});
 const status=await Promise.race([
  new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal}))),
  delay(6000).then(()=>({timeout:true}))
 ]);
 if(status.timeout){child.kill('SIGKILL');throw Error('Guard did not terminate')}
 assert.notEqual(status.code,0);
 assert.match(stderr,phrase);
}

test('setup-only refuses all supplied database passwords instead of attempting connection',async()=>{
 await expectReject({...baseEnv(),PGPASSWORD:'fabricated-not-real'},/OP37_SETUP_ONLY_GUARD_FAILED/);
});

test('full benchmark cannot start without verified staging-only credentials',async()=>{
 await expectReject({
  ...baseEnv(),OP37_STAGING_SETUP_ONLY:'no'
 },/OP37_STAGING_GUARD_FAILED/);
});
