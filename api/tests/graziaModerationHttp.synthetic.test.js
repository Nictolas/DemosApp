'use strict';
// Isolated HTTP test of the real Grazia Express router with fake Postgres, zero private data.
const {test, after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const express=require('express');
const realNominationGate=require('../utils/thirdPartyNominationGate');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const ADMIN='33333333-3333-4333-8333-333333333333';
const users=new Set([A,B,ADMIN]);
const suspendedUsers=new Set();
const catalog=[{id:1,nome:'Persona già verificata',attivo:true}];
const requests=[];
const notices=[];
let queryCalls=0;
let nextId=2;
let failNotifications=false;
let failConnect=false;
let adminAvailable=true;
let recipientAvailable=true;
let nominationEnabled=true;

const pool={
  async query(sql,params=[]){return respond(sql,params);},
  async connect(){
    if(failConnect)throw Error('SYNTHETIC_POOL_CONNECT_FAILURE');
    return {query:async(sql,params=[])=>respond(sql,params),release(){}};
  }
};
function respond(statement,values){
  queryCalls++;
  const sql=String(statement).trim();
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]};
  if(sql.startsWith("SELECT id FROM users WHERE id = $1 AND status = 'a' FOR UPDATE"))
    return {rows:users.has(values[0])&&!suspendedUsers.has(values[0])?[{id:values[0]}]:[]};
  if(sql.includes("FROM richieste_grazia WHERE utente_id = $1 AND status = 'pending'"))
    return {rows:requests.filter(r=>r.utente_id===values[0]&&r.status==='pending').map(r=>({id:r.id}))};
  if(sql.includes("FROM richieste_grazia WHERE status IN ('pending','approved')")){
    const canonical = value => String(value||'').normalize('NFC').trim().replace(/\s+/g,' ').toLowerCase();
    const matches=requests.filter(r=>
      (r.status==='pending'||r.status==='approved')&&!r.withdrawn_at&&
      canonical(r.nome)===canonical(values[0])).map(r=>({id:r.id}));
    return {rows:matches,rowCount:matches.length};
  }
  if(sql.includes('FROM grazia_carcerati WHERE attivo = true') && sql.includes('LOWER(BTRIM(nome))'))
    return {rows:catalog.filter(r=>r.attivo&&r.nome.toLowerCase()===String(values[0]).toLowerCase()).map(r=>({id:r.id}))};
  if(sql.startsWith('INSERT INTO richieste_grazia')){
    requests.push({id:values[0],utente_id:values[1],nome:values[2],url_prova:values[3],status:'pending',data_creazione:'2026-10-31T14:00:00Z'});
    return {rows:[],rowCount:1};
  }
  if(sql.startsWith('INSERT INTO notifiche_demos')){
    if(failNotifications)throw Error('SYNTHETIC_PRIVATE_NOTIFICATION_FAILURE');
    if(sql.includes('FROM users WHERE is_admin')){
      if(!adminAvailable)return {rows:[],rowCount:0};
      notices.push({to:ADMIN,text:'Una proposta Grazia è in attesa di revisione.'});
    }else{
      if(!recipientAvailable)return {rows:[],rowCount:0};
      notices.push({to:values[0],text:values[1]});
    }
    return {rows:[],rowCount:1};
  }
  if(sql.includes('FROM richieste_grazia WHERE status =') && sql.includes('ORDER BY data_creazione')){
    return {rows:requests.filter(r=>r.status==='pending').map(r=>({id:r.id,nome:r.nome,urlProva:r.url_prova,createdAt:r.data_creazione}))};
  }
  if(sql.includes('FROM richieste_grazia WHERE utente_id = $1') && sql.includes('ORDER BY data_creazione')){
    // The fake pool enforces the actual SQL active-owner predicate: removing
    // it must fail this regression rather than silently passing in the stub.
    if(!sql.includes("AND EXISTS (SELECT 1 FROM users WHERE id::text = $1::text AND status = 'a')"))
      throw Error('SYNTHETIC_MISSING_ACTIVE_OWNER_CHECK');
    return {rows:suspendedUsers.has(values[0])?[]:
      requests.filter(r=>r.utente_id===values[0]).slice(-1)
        .map(r=>({id:r.id,status:r.status,data_creazione:r.data_creazione}))};
  }
  if(sql.includes("FROM richieste_grazia WHERE id = $1 AND status = 'pending' FOR UPDATE")){
    return {rows:requests.filter(r=>r.id===values[0]&&r.status==='pending').map(r=>({id:r.id,nome:r.nome,utente_id:r.utente_id}))};
  }
  if(sql.startsWith('INSERT INTO grazia_carcerati')){
    if(!catalog.some(x=>x.nome.toLowerCase()===String(values[0]).toLowerCase())){
      catalog.push({id:nextId++,nome:values[0],attivo:true});
    }
    return {rows:[],rowCount:1};
  }
  if(sql.startsWith('UPDATE grazia_carcerati SET attivo')){
    const row=catalog.find(x=>x.nome.toLowerCase()===String(values[0]).toLowerCase());
    if(row)row.attivo=true;return {rows:[],rowCount:row?1:0};
  }
  if(sql.startsWith('UPDATE richieste_grazia SET status')){
    const row=requests.find(x=>x.id===values[1] && x.status==='pending');
    if(row)row.status=values[0];return {rows:[],rowCount:row?1:0};
  }
  if(sql.includes('FROM grazia_carcerati c') && sql.includes('LEFT JOIN voti_grazia')){
    return {rows:catalog.filter(c=>c.attivo).map(c=>({nome:c.nome,richieste:0}))};
  }
  return {rows:[]};
}

function mock(target,exports){
  const resolved=require.resolve(target);require.cache[resolved]={id:resolved,filename:resolved,loaded:true,exports};
}
const verifyToken=(req,res,next)=>{
  const token=req.headers.authorization;
  const id=token==='Bearer synthetic-a'?A:token==='Bearer synthetic-b'?B:token==='Bearer synthetic-admin'?ADMIN:null;
  if(!id)return res.status(401).json({success:false,error:'Token richiesto'});
  req.user={id,isAdmin:id===ADMIN};req.userId=id;next();
};
const requireAdmin=(req,res,next)=>req.user?.isAdmin?next():res.status(403).json({success:false});
mock('../config/database',{getPool:()=>pool});
mock('../middleware/auth',{verifyToken,requireAdmin,pool});
mock('../middleware/politicalConsent',{requirePoliticalConsent:(req,res,next)=>next()});
mock('../middleware/civicIdentity',{requireVerifiedCivicIdentity:(req,res,next)=>next()});
mock('../middleware/validation',{validateInput:()=> (req,res,next)=>next()});
mock('../services/preferenceCooldownService',{getPreferenceCooldown:async()=>({isBlocked:false}),assertPreferenceChangeAllowed:async()=>{},recordPreferenceChange:async()=>{},sendCooldownError:()=>false});
// The real server gate is fail-closed. This fixture is an isolated fake pool,
// so it explicitly enables synthetic requests without changing process env.
mock('../utils/thirdPartyNominationGate',{
  isNominationWriteEnabled:()=>true,
  isGraziaNominationWriteEnabled:()=>nominationEnabled,
  rejectUnavailableNomination:res=>res.status(503).json({success:false,error:'PROPOSTE_NON_DISPONIBILI'})
});
const app=express();
app.use(express.json());app.use('/api/grazia',require('../routes/grazia'));
const server=http.createServer(app);
let base;
async function request(url,user,method='GET',body){
  if(!base){await new Promise(done=>server.listen(0,'127.0.0.1',done));base='http://127.0.0.1:'+server.address().port;}
  return fetch(base+url,{method,headers:{...(user?{authorization:'Bearer synthetic-'+user}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
}
after(async()=>{if(server.listening)await new Promise(resolve=>server.close(resolve));});

test('Grazia rejects local and private HTTPS sources before writing a request',async()=>{
  const count=requests.length;
  for(const source of ['https://localhost/','https://127.0.0.1/','https://192.168.1.1/','https://[::1]/','https://server.internal/']){
    const result=await request('/api/grazia','a','POST',{nome:'Persona sintetica',urlProva:source});
    assert.equal(result.status,400,source);
    assert.equal(requests.length,count,source);
  }
});

test('Grazia rejects non-rendering name controls before touching PostgreSQL',async()=>{
  const beforeRequests=requests.length;
  const beforeQueries=queryCalls;
  const beforeNotices=notices.length;
  // These inputs can spoof an otherwise ordinary visible name in moderation.
  // Legitimate accents and multiline whitespace are tested separately.
  for(const nome of [
    'Persona\u202e nome',
    'Persona\u2066 nome',
    'Persona\u200b nome',
    'Persona\u061c nome',
    'Persona\u0000 nome',
    'Persona\u007f nome',
    'Persona\u00ad nome',
    'Persona\u034f nome',
    'Persona\u180e nome'
  ]) {
    const response=await request('/api/grazia','a','POST',{
      nome,urlProva:'https://example.org/fonte-sintetica'
    });
    assert.equal(response.status,400,'invisible formatting/control must be rejected');
    assert.match(response.headers.get('cache-control')||'',/private.*no-store/);
    assert.equal((await response.json()).success,false);
  }
  assert.equal(queryCalls,beforeQueries,'invalid names must not acquire a DB connection');
  assert.equal(requests.length,beforeRequests,'no private name was persisted');
  assert.equal(notices.length,beforeNotices,'no Admin notification was created');
});

test('Grazia vote input rejects hidden and directional control characters before SQL',async()=>{
  const before=queryCalls;
  const invalid=[
    'Persona\u0000 nascosta',
    'Persona\u202e invertita',
    'Persona\u2066 isolata',
    'Persona\u200b invisibile',
    'Persona\u007f controllo',
    'Persona\u061c direzionale',
    'Persona\u00ad soft-hyphen',
    'Persona\u034f grapheme-joiner',
    'Persona\u180e mongolian-separator'
  ];
  for(const nome of invalid){
    const response=await request('/api/grazia/vota','a','POST',{voti:[nome]});
    assert.equal(response.status,400,'malformed private vote name must fail safely');
    assert.match(response.headers.get('cache-control')||'',/private.*no-store/);
    assert.equal((await response.json()).error,'Preferenza Grazia non valida');
  }
  assert.equal(queryCalls,before,'invalid votes cannot trigger vote metadata or persistence SQL');
});

test('suspended account with stale cached JWT cannot submit a private Grazia nomination',async()=>{
  const before=requests.length;
  const beforeNotices=notices.length;
  suspendedUsers.add(B);
  try{
    const res=await request('/api/grazia','b','POST',{
      nome:'Persona di test nominata da account sospeso',
      urlProva:'https://example.org/fonte/isolata'
    });
    assert.equal(res.status,401,'active account row is mandatory');
    assert.match(res.headers.get('cache-control')||'',/no-store/);
    assert.equal(requests.length,before,'no nomination persisted');
    assert.equal(notices.length,beforeNotices,'no notification for a rejected request');
  }finally{
    suspendedUsers.delete(B);
  }
});

test('Grazia one pending proposal per user, real persistence before success',async()=>{
  // Deliberately submit a multiline, decomposed-Unicode name. The HTTP
  // route must persist only the canonical form used by its duplicate check.
  const data={nome:'Pe\u0301rsona  \n   da   verificare',urlProva:'https://example.org/fonte-pubblica'};
  assert.equal((await request('/api/grazia',null,'POST',data)).status,401);
  assert.equal((await request('/api/grazia','a','POST',{nome:'X',urlProva:data.urlProva})).status,400);
  assert.equal((await request('/api/grazia','a','POST',{nome:data.nome,urlProva:'http://insecure.example.org'})).status,400);
  const created=await request('/api/grazia','a','POST',data);
  assert.equal(created.status,202);
  assert.equal((await created.json()).richiesta.status,'pending');
  assert.equal(requests.filter(r=>r.utente_id===A && r.status==='pending').length,1);
  assert.equal(requests.find(r=>r.utente_id===A && r.status==='pending').nome,'Pérsona da verificare',
    'store only NFC text with collapsed whitespace, not the raw multiline input');
  assert.equal((await request('/api/grazia','a','POST',{nome:'Altra persona',urlProva:data.urlProva})).status,409);
  // A separate account cannot create a parallel entry for the same person.
  assert.equal((await request('/api/grazia','b','POST',{
    nome:'  Pérsona   da   verificare  ',urlProva:data.urlProva
  })).status,409);
  assert.equal(requests.filter(r=>r.status==='pending').length,1);
  assert.ok(notices.some(n=>n.to===ADMIN));
  const self=await (await request('/api/grazia/mia-proposta','a')).json();
  const other=await (await request('/api/grazia/mia-proposta','b')).json();
  assert.equal(self.richiesta.status,'pending');assert.equal(other.richiesta,null);
});
test('Grazia private proposal status is neutral while owner is suspended with a stale JWT',async()=>{
  // The mock JWT remains valid, but the database account switches to inactive.
  const activeBefore=await request('/api/grazia/mia-proposta','a');
  assert.equal(activeBefore.status,200);
  assert.equal((await activeBefore.json()).richiesta?.status,'pending');

  suspendedUsers.add(A);
  try{
    const before=queryCalls;
    const hidden=await request('/api/grazia/mia-proposta','a');
    assert.equal(hidden.status,200);
    assert.match(hidden.headers.get('cache-control')||'',/private.*no-store/);
    assert.deepEqual(await hidden.json(),{success:true,richiesta:null},
      'suspended owner must not read private proposal status or its ID');
    assert.equal(queryCalls,before+1,'suspension guard does not add a second DB query');
  }finally{
    suspendedUsers.delete(A);
  }
  const restored=await request('/api/grazia/mia-proposta','a');
  assert.equal(restored.status,200);
  assert.equal((await restored.json()).richiesta?.status,'pending',
    'reactivated user retains the same personal response shape');
});

test('Grazia moderation is Admin-only, atomic and does not publish rejected subjects',async()=>{
  assert.equal((await request('/api/grazia/richieste','a')).status,403);
  assert.equal((await request('/api/grazia/richieste',null)).status,401);
  const pending=await (await request('/api/grazia/richieste','admin')).json();
  assert.equal(pending.length,1);
  const id=pending[0].id;
  assert.equal((await request('/api/grazia/richiesta/'+id+'/accetta','a','POST')).status,403);
  assert.equal((await request('/api/grazia/richiesta/'+id+'/anything','admin','POST')).status,400);
  const accepted=await request('/api/grazia/richiesta/'+id+'/accetta','admin','POST');
  assert.equal(accepted.status,200);assert.equal((await accepted.json()).status,'approved');
  assert.ok(catalog.some(x=>x.nome==='Pérsona da verificare'&&x.attivo));
  assert.equal((await request('/api/grazia/richiesta/'+id+'/accetta','admin','POST')).status,409);
  assert.ok(notices.some(n=>n.to===A && n.text.includes('approvata')));
  const publicView=await (await request('/api/grazia',null)).json();
  assert.ok(publicView.classifica.some(x=>x.nome==='Pérsona da verificare'));
  assert.deepEqual(publicView.richieste,[]);
});

test('Grazia dual opt-in is exact and approval cannot bypass the disabled gate',async()=>{
  // Pure production flag function: both exact opt-ins are mandatory.
  const env=(general,grazia)=>({
    DEMOS_THIRD_PARTY_NOMINATIONS_ENABLED:general,
    DEMOS_GRAZIA_NOMINATIONS_ENABLED:grazia
  });
  for(const [general,grazia] of [
    [undefined,undefined],['true',undefined],[undefined,'true'],
    ['false','true'],['true','false'],['TRUE','true'],['true','TRUE']
  ]){
    assert.equal(realNominationGate.isGraziaNominationWriteEnabled(env(general,grazia)),false);
  }
  assert.equal(realNominationGate.isGraziaNominationWriteEnabled(env('true','true')),true);

  // Same Express router as production, with a synthetic pool and no user data.
  const name='Persona sintetica doppio flag negato';
  const body={nome:name,urlProva:'https://example.org/fonte-pubblica'};
  const count=requests.length;
  const priorCatalogue=catalog.length;
  nominationEnabled=false;
  failConnect=true; // If a disabled operation touches SQL, this test fails.
  try{
    const blocked=await request('/api/grazia','b','POST',body);
    assert.equal(blocked.status,503);
    assert.match(blocked.headers.get('cache-control')||'',/private.*no-store/);
    assert.equal((await blocked.json()).error,'PROPOSTE_NON_DISPONIBILI');
    assert.equal(requests.length,count,'no private nomination persisted while disabled');
  }finally{
    failConnect=false;
    nominationEnabled=true;
  }

  // Create the only pending synthetic request while opt-in is permitted.
  const accepted=await request('/api/grazia','b','POST',body);
  assert.equal(accepted.status,202);
  const id=(await accepted.json()).richiesta.id;
  nominationEnabled=false;
  failConnect=true;
  try{
    for(const action of ['accetta','approve']){
      const blocked=await request('/api/grazia/richiesta/'+id+'/'+action,'admin','POST');
      assert.equal(blocked.status,503,'admin '+action+' must remain fail-closed');
      assert.match(blocked.headers.get('cache-control')||'',/private.*no-store/);
      assert.equal((await blocked.json()).error,'PROPOSTE_NON_DISPONIBILI');
    }
    assert.equal(requests.find(r=>r.id===id).status,'pending');
    assert.equal(catalog.length,priorCatalogue,'disabled approval must not publish names');
  }finally{
    failConnect=false;
  }
  try{
    // A disabled publication gate must not prevent rejecting a pending request.
    const rejected=await request('/api/grazia/richiesta/'+id+'/rifiuta','admin','POST');
    assert.equal(rejected.status,200);
    assert.equal((await rejected.json()).status,'rejected');
    assert.equal(requests.find(r=>r.id===id).status,'rejected');
    assert.equal(catalog.length,priorCatalogue);
  }finally{
    nominationEnabled=true;
    failConnect=false;
  }
});

test('Grazia proposal and Admin decision remain committed when notification fails',async()=>{
  failNotifications=true;
  try {
    const create=await request('/api/grazia','b','POST',{nome:'Persona sintetica non verificata B',urlProva:'https://example.org/fonti-pubbliche'});
    assert.equal(create.status,202,'persistence is independent of push/inbox');
    assert.match(create.headers.get('cache-control')||'',/no-store/);
    const payload=await create.json();
    assert.equal(payload.success,true);
    assert.equal(payload.notification_sent,false);
    assert.equal(requests.filter(r=>r.utente_id===B&&r.status==='pending').length,1);
    const adminList=await request('/api/grazia/richieste','admin');
    assert.match(adminList.headers.get('cache-control')||'',/no-store/);
    const pending=(await adminList.json()).find(r=>r.nome==='Persona sintetica non verificata B');
    assert.ok(pending,'the pending proposal exists despite notification failure');
    assert.deepEqual(Object.keys(pending).sort(), ['createdAt','id','nome','urlProva'].sort(),
      'private Admin queue must not expose proposer UUID or unrelated fields');
    const approved=await request('/api/grazia/richiesta/'+pending.id+'/rifiuta','admin','POST');
    assert.equal(approved.status,200);
    const answer=await approved.json();
    assert.equal(answer.status,'rejected');
    assert.equal(answer.notification_sent,false);
    assert.equal(requests.find(r=>r.id===pending.id).status,'rejected');
    assert.equal((await request('/api/grazia/richiesta/'+pending.id+'/rifiuta','admin','POST')).status,409);
    assert.equal(catalog.some(r=>r.nome==='Persona sintetica non verificata B'),false);
  } finally {failNotifications=false;}
});


test('Grazia proposal persists but notification_sent stays false without an active Admin',async()=>{
  const before=notices.length;
  adminAvailable=false;
  try {
    const resp=await request('/api/grazia','b','POST',{
      nome:'Persona sintetica senza destinatario attivo',
      urlProva:'https://example.org/fonte-pubblica'
    });
    assert.equal(resp.status,202,'an empty Admin recipient list must not roll back the proposal');
    const payload=await resp.json();
    assert.equal(payload.success,true);
    assert.equal(payload.notification_sent,false,'zero INSERT rows are not a sent notification');
    assert.equal(requests.filter(r=>r.utente_id===B && r.status==='pending').length,1);
    assert.equal(notices.length,before,'no notification recipient, no new inbox entry');

    // The recipient can become unavailable before moderation finishes.
    // The Admin decision must still commit, but must not claim notification.
    recipientAvailable=false;
    const reviewed=await request('/api/grazia/richiesta/'+payload.richiesta.id+'/rifiuta','admin','POST');
    assert.equal(reviewed.status,200);
    const result=await reviewed.json();
    assert.equal(result.status,'rejected');
    assert.equal(result.notification_sent,false,'no active recipient means no confirmed decision notification');
    assert.equal(requests.find(r=>r.id===payload.richiesta.id).status,'rejected');
    assert.equal(notices.length,before,'no inbox row without a recipient');
  }finally{
    adminAvailable=true;
    recipientAvailable=true;
  }
});

test('Grazia disabled SQL connector returns generic 500 with no raw error or stuck request',async()=>{
  failConnect=true;
  try {
    const r=await request('/api/grazia','b','POST',{nome:'Terza persona sintetica',urlProva:'https://example.org/fonte'});
    assert.equal(r.status,500);
    assert.match(r.headers.get('cache-control')||'',/no-store/);
    assert.doesNotMatch(JSON.stringify(await r.json()),/SYNTHETIC_POOL_CONNECT_FAILURE/);
    const review=await request('/api/grazia/richiesta/legacy-review-001/accetta','admin','POST');
    assert.equal(review.status,500);
    assert.match(review.headers.get('cache-control')||'',/no-store/);
    assert.doesNotMatch(JSON.stringify(await review.json()),/SYNTHETIC_POOL_CONNECT_FAILURE/);
  } finally {failConnect=false;}
});

test('Grazia GET with optional token and personal status are private no-store',async()=>{
  for(const [p,t] of [['/api/grazia',null],['/api/grazia/mia-proposta','a'],['/api/grazia/richieste','admin']]){
    const r=await request(p,t);
    assert.match(r.headers.get('cache-control')||'',/no-store/,p);
    assert.match(r.headers.get('cache-control')||'',/private/,p);
  }
});


test('Grazia review rejects malformed reference before acquiring SQL',async()=>{
  // A synthetic offline pool proves invalid references never reach SQL.
  // Historical alphanumeric/hyphen/underscore IDs remain supported.
  failConnect=true;
  try {
    for(const bad of ['---','_leading','x'.repeat(256),'x*bad','è-invalid']){
      for(const action of ['rifiuta','accetta']){
        const response=await request('/api/grazia/richiesta/'+encodeURIComponent(bad)+'/'+action,'admin','POST');
        assert.equal(response.status,400,'invalid reference rejected before SQL: '+bad);
        assert.match(response.headers.get('cache-control')||'',/private.*no-store/);
        const body=await response.json();
        assert.equal(body.success,false);
        assert.doesNotMatch(JSON.stringify(body),/SYNTHETIC_POOL_CONNECT_FAILURE/);
      }
    }
    const legacy=await request('/api/grazia/richiesta/legacy-request_001/rifiuta','admin','POST');
    assert.equal(legacy.status,500,'legacy-compatible reference reaches the synthetic offline pool');
    assert.match(legacy.headers.get('cache-control')||'',/no-store/);
  }finally{failConnect=false;}
});


test('Grazia Admin rejects malformed paged mode before any SQL',async()=>{
  const before=queryCalls;
  for(const q of ['paged=2','paged=TRUE','paged=','paged=1&paged=0']){
    const response=await request('/api/grazia/richieste?'+q,'admin');
    assert.equal(response.status,400,'invalid mode '+q);
    assert.match(response.headers.get('cache-control')||'',/private.*no-store/);
    const body=await response.json();
    assert.equal(body.success,false);
  }
  assert.equal(queryCalls,before,'invalid modes cannot load the legacy Admin list');
  const legacy=await request('/api/grazia/richieste?paged=0','admin');
  assert.equal(legacy.status,200,'explicit legacy mode remains compatible');
});
