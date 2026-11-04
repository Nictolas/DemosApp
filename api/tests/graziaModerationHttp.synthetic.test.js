'use strict';
// Isolated HTTP test of the real Grazia Express router with fake Postgres, zero private data.
const {test, after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const express=require('express');
const A='11111111-1111-4111-8111-111111111111';
const B='22222222-2222-4222-8222-222222222222';
const ADMIN='33333333-3333-4333-8333-333333333333';
const users=new Set([A,B,ADMIN]);
const catalog=[{id:1,nome:'Persona già verificata',attivo:true}];
const requests=[];
const notices=[];
let nextId=2;
let failNotifications=false;
let failConnect=false;
let adminAvailable=true;
let recipientAvailable=true;

const pool={
  async query(sql,params=[]){return respond(sql,params);},
  async connect(){
    if(failConnect)throw Error('SYNTHETIC_POOL_CONNECT_FAILURE');
    return {query:async(sql,params=[])=>respond(sql,params),release(){}};
  }
};
function respond(statement,values){
  const sql=String(statement).trim();
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]};
  if(sql.startsWith('SELECT id FROM users WHERE id = $1 FOR UPDATE'))
    return {rows:users.has(values[0])?[{id:values[0]}]:[]};
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
  if(sql.includes('FROM richieste_grazia WHERE utente_id = $1 ORDER BY data_creazione')){
    return {rows:requests.filter(r=>r.utente_id===values[0]).slice(-1).map(r=>({id:r.id,status:r.status,data_creazione:r.data_creazione}))};
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
const app=express();
app.use(express.json());app.use('/api/grazia',require('../routes/grazia'));
const server=http.createServer(app);
let base;
async function request(url,user,method='GET',body){
  if(!base){await new Promise(done=>server.listen(0,'127.0.0.1',done));base='http://127.0.0.1:'+server.address().port;}
  return fetch(base+url,{method,headers:{...(user?{authorization:'Bearer synthetic-'+user}:{}),...(body?{'content-type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
}
after(async()=>{if(server.listening)await new Promise(resolve=>server.close(resolve));});

test('Grazia one pending proposal per user, real persistence before success',async()=>{
  const data={nome:'Persona da verificare',urlProva:'https://example.org/fonte-pubblica'};
  assert.equal((await request('/api/grazia',null,'POST',data)).status,401);
  assert.equal((await request('/api/grazia','a','POST',{nome:'X',urlProva:data.urlProva})).status,400);
  assert.equal((await request('/api/grazia','a','POST',{nome:data.nome,urlProva:'http://insecure.example.org'})).status,400);
  const created=await request('/api/grazia','a','POST',data);
  assert.equal(created.status,202);
  assert.equal((await created.json()).richiesta.status,'pending');
  assert.equal(requests.filter(r=>r.utente_id===A && r.status==='pending').length,1);
  assert.equal((await request('/api/grazia','a','POST',{nome:'Altra persona',urlProva:data.urlProva})).status,409);
  // A separate account cannot create a parallel entry for the same person.
  assert.equal((await request('/api/grazia','b','POST',{
    nome:'  Persona   da   verificare  ',urlProva:data.urlProva
  })).status,409);
  assert.equal(requests.filter(r=>r.status==='pending').length,1);
  assert.ok(notices.some(n=>n.to===ADMIN));
  const self=await (await request('/api/grazia/mia-proposta','a')).json();
  const other=await (await request('/api/grazia/mia-proposta','b')).json();
  assert.equal(self.richiesta.status,'pending');assert.equal(other.richiesta,null);
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
  assert.ok(catalog.some(x=>x.nome==='Persona da verificare'&&x.attivo));
  assert.equal((await request('/api/grazia/richiesta/'+id+'/accetta','admin','POST')).status,409);
  assert.ok(notices.some(n=>n.to===A && n.text.includes('approvata')));
  const publicView=await (await request('/api/grazia',null)).json();
  assert.ok(publicView.classifica.some(x=>x.nome==='Persona da verificare'));
  assert.deepEqual(publicView.richieste,[]);
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
    const review=await request('/api/grazia/richiesta/unknown/accetta','admin','POST');
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
