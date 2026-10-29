'use strict';

/**
 * DOC-061: public fail-closed smoke probe of the real, setup-only OP-37
 * Render service. No secrets, no authorization header, no SQL or user data.
 * This is NOT an end-to-end test of the DB-connected benchmark.
 */
const assert=require('node:assert/strict');

const BASE='https://demos-sondaggi-op37-http-staging.onrender.com';
const ROUTES=[
  ['/',200],
  ['/health',503],
  ['/benchmark/summary',503],
  ['/api/sondaggi',404],
  ['/api/sondaggi/toscana',404],
  ['/api/sondaggi/toscana/pisa',404],
  ['/api/sondaggi/toscana/pisa/pisa',404],
  ['/api/users',404]
];

function guard(){
  if(process.env.GITHUB_ACTIONS!=='true'||
     process.env.OP37_PUBLIC_SETUP_PROBE!=='no-credentials'||
     process.env.OP37_STAGING_HTTP_ONLY!=='yes'){
    throw Error('Refusing live probe outside explicitly scoped GitHub CI');
  }
}
async function fetchWithLimitedRetry(path){
  let last;
  for(let i=0;i<3;i++){
    try{
      // Render free can be asleep. We never include credentials or user
      // inputs in the request, and restrict redirects to prevent SSRF.
      const response=await fetch(BASE+path,{
        method:'GET',redirect:'manual',
        headers:{'Accept':'application/json'},
        signal:AbortSignal.timeout(75000)
      });
      if(response.status>=300&&response.status<400){
        throw Error('Unexpected redirect '+response.status);
      }
      if(response.status>=500&&response.status!==503&&i<2){
        last=Error('Transient status '+response.status);
        continue;
      }
      const body=await response.text();
      if(body.length>6000)throw Error('Unexpected large public response');
      return {response,body:JSON.parse(body)};
    }catch(e){
      last=e;
      if(i===2)break;
    }
  }
  throw last;
}
async function main(){
  guard();
  const results=[];
  for(const [path,status] of ROUTES){
    const {response,body}=await fetchWithLimitedRetry(path);
    assert.equal(response.status,status,path);
    assert.equal(response.headers.get('cache-control'),'no-store',path);
    if(path==='/'){
      assert.equal(body.mode,'setup_required');
      assert.equal(body.databaseConnected,false);
      assert.equal(body.productionConnected,false);
    }else if(path==='/health'){
      assert.equal(body.ready,false);
      assert.equal(body.reason,'staging_credential_not_configured');
    }else if(path==='/benchmark/summary'){
      assert.equal(body.ready,false);
    }else{
      assert.equal(body.error,'not_found',path);
    }
    results.push({path,status});
  }
  console.log('OP37_RENDER_PUBLIC_SETUP_DENIALS_PASS');
  console.log('OP37_RENDER_PUBLIC_SETUP_DENIALS_RESULT_JSON='+JSON.stringify({
    service:'demos-sondaggi-op37-http-staging',
    mode:'setup-only',
    observations:results,
    credentialsUsed:false,
    databaseAccessed:false,
    appBenchmarkPerformed:false,
    productionTouched:false,
    notes:'Remote public HTTP smoke checks only; SQL and full benchmark remain blocked.'
  }));
}
main().catch(err=>{
  console.error('OP37_REMOTE_SETUP_PROBE_FAILED',
    String(err.message||err).slice(0,250));
  process.exitCode=1;
});
