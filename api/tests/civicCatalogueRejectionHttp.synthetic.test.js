'use strict';
// Actual Express routes with fake auth and read-only synthetic SQL; never reaches a live database.
const {test,after}=require('node:test');
const assert=require('node:assert/strict');
const http=require('node:http');
const express=require('express');
const USER='11111111-1111-4111-8111-111111111111';
const sqlCalls=[];
const pool={
  async query(sql,params=[]){
    sqlCalls.push({sql:String(sql),params});
    if(String(sql).includes('EXISTS (SELECT 1 FROM voti_capo_stato WHERE nome = $1)') && String(sql).includes('FROM capo_stato_soggetti_approvati')){
      return {rows:params[0]==='Candidato esistente'?[{exists:1}]:[]};
    }
    throw Error('Unexpected query in rejection-only test: '+String(sql).slice(0,100));
  },
  async connect(){throw Error('Rejection must occur before opening DB transaction');}
};
const authPath=require.resolve('../middleware/auth');
const dbPath=require.resolve('../config/database');
const civicPath=require.resolve('../middleware/civicIdentity');
const politicalPath=require.resolve('../middleware/politicalConsent');
const validationPath=require.resolve('../middleware/validation');
const cooldownPath=require.resolve('../services/preferenceCooldownService');
const verifyToken=(req,res,next)=>{
  if(req.headers.authorization!=='Bearer synthetic')return res.status(401).json({success:false,error:'Unauthorized'});
  req.user={id:USER,isAdmin:false};req.userId=USER;next();
};
require.cache[authPath]={id:authPath,filename:authPath,loaded:true,exports:{verifyToken,requireAdmin:(req,res,next)=>res.status(403).json({success:false}),pool}};
require.cache[dbPath]={id:dbPath,filename:dbPath,loaded:true,exports:{getPool:()=>pool}};
const noop=(req,res,next)=>next();
require.cache[civicPath]={id:civicPath,filename:civicPath,loaded:true,exports:{requireVerifiedCivicIdentity:noop}};
require.cache[politicalPath]={id:politicalPath,filename:politicalPath,loaded:true,exports:{requirePoliticalConsent:noop}};
require.cache[validationPath]={id:validationPath,filename:validationPath,loaded:true,exports:{validateInput:()=>noop}};
require.cache[cooldownPath]={id:cooldownPath,filename:cooldownPath,loaded:true,exports:{getPreferenceCooldown:async()=>({isBlocked:false}),assertPreferenceChangeAllowed:async()=>{},recordPreferenceChange:async()=>{},sendCooldownError:()=>false}};
const app=express();app.use(express.json());
app.use('/api/amnistia',require('../routes/amnistia'));
app.use('/api/capo-stato',require('../routes/capo-stato'));
const server=http.createServer(app);let base;
async function req(uri,token,body){
  if(!base){await new Promise(ok=>server.listen(0,'127.0.0.1',ok));base='http://127.0.0.1:'+server.address().port;}
  const resp=await fetch(base+uri,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
  return {status:resp.status,body:await resp.json()};
}
after(async()=>{if(server.listening)await new Promise(ok=>server.close(ok));});

test('Amnistia unauthenticated 401; authenticated proposal 409 without any SQL or public row',async()=>{
  assert.equal((await req('/api/amnistia',null,{legge:'L',articolo:'A',descrizione:'D'})).status,401);
  const result=await req('/api/amnistia','synthetic',{legge:'Fittizia',articolo:'1',descrizione:'Non deve entrare nel catalogo'});
  assert.equal(result.status,409);
  assert.equal(result.body.code,'MODERATION_REQUIRED');
  assert.equal(sqlCalls.length,0,'no query executed by blocked proposals');
});

test('Capo di Stato name not in historical candidates returns 422 before any vote write',async()=>{
  const result=await req('/api/capo-stato/vota','synthetic',{voti:['Nuovo nome non approvato']});
  assert.equal(result.status,422,JSON.stringify(result.body));
  assert.equal(sqlCalls.length,1);
  assert.match(sqlCalls[0].sql,/^SELECT 1 WHERE/);
  assert.match(sqlCalls[0].sql,/capo_stato_soggetti_approvati/);
  assert.deepEqual(sqlCalls[0].params,['Nuovo nome non approvato']);
});

test('Capo di Stato invalid vote inputs and ineligible candidate do not touch DB',async()=>{
  const before=sqlCalls.length;
  assert.equal((await req('/api/capo-stato/vota','synthetic',{voti:['uno','due']})).status,400);
  assert.equal((await req('/api/capo-stato/vota','synthetic',{voti:[123]})).status,400);
  assert.equal((await req('/api/capo-stato/vota','synthetic',{voti:['Emma Bonino']})).status,422);
  assert.equal(sqlCalls.length,before);
});
