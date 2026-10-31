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

const pool={
  async query(sql,params=[]){return respond(sql,params);},
  async connect(){return {query:async(sql,params=[])=>respond(sql,params),release(){}};}
};
function respond(statement,values){
  const sql=String(statement).trim();
  if(['BEGIN','COMMIT','ROLLBACK'].includes(sql))return {rows:[]};
  if(sql.startsWith('SELECT id FROM users WHERE id = $1 FOR UPDATE'))
    return {rows:users.has(values[0])?[{id:values[0]}]:[]};
  if(sql.includes("FROM richieste_grazia WHERE utente_id = $1 AND status = 'pending'"))
    return {rows:requests.filter(r=>r.utente_id===values[0]&&r.status==='pending').map(r=>({id:r.id}))};
  if(sql.includes('FROM grazia_carcerati WHERE attivo = true') && sql.includes('LOWER(BTRIM(nome))'))
    return {rows:catalog.filter(r=>r.attivo&&r.nome.toLowerCase()===String(values[0]).toLowerCase()).map(r=>({id:r.id}))};
  if(sql.startsWith('INSERT INTO richieste_grazia')){
    requests.push({id:values[0],utente_id:values[1],nome:values[2],url_prova:values[3],status:'pending',data_creazione:'2026-10-31T14:00:00Z'});
    return {rows:[],rowCount:1};
  }
  if(sql.startsWith('INSERT INTO notifiche_demos')){
    if(sql.includes('FROM users WHERE is_admin')){
      notices.push({to:ADMIN,text:'Una proposta Grazia è in attesa di revisione.'});
    }else{
      notices.push({to:values[0],text:values[1]});
    }
    return {rows:[],rowCount:1};
  }
  if(sql.includes('FROM richieste_grazia WHERE status =') && sql.includes('ORDER BY data_creazione')){
    return {rows:requests.filter(r=>r.status==='pending').map(r=>({id:r.id,nome:r.nome,urlProva:r.url_prova,userId:r.utente_id,createdAt:r.data_creazione}))};
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
