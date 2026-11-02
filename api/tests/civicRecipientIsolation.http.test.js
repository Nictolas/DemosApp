'use strict';

// Isolated HTTP contracts for notification recipient privacy on the civic branch.
// Uses two synthetic JWT identities, in-memory DB, no Supabase, Render or Firebase.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const fs = require('node:fs');
const path = require('node:path');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const notices = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id_utente: null,
    titolo: 'Generale', testo: 'Globale', data_creazione: '2026-11-01T00:00:00Z' },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id_utente: A,
    titolo: 'Sicurezza', testo: 'PRIVATE_A_ONLY', data_creazione: '2026-11-02T00:03:00Z' },
  { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', id_utente: B,
    titolo: 'Notifica senza prefisso', testo: 'PRIVATE_B_ONLY', data_creazione: '2026-11-02T00:04:00Z' }
];
const queries = [];
let failDb = false;
const db = {
  async query(text, values = []) {
    const sql = String(text);
    queries.push({sql,values});
    if (failDb) {
      const e = new Error('SECRET_DSN_FOR_TEST_ONLY');
      e.code = 'ECONNREFUSED';
      throw e;
    }
    if (sql.includes("WHERE table_name = 'notifiche_demos'")) {
      return {rows:[{column_name:'titolo'},{column_name:'testo'}]};
    }
    if (sql.includes('FROM users WHERE id = $1')) {
      return {rows:[{comune_residenza:null, rappresentante_camera:null,
        rappresentante_senato:null, rappresentante_comune:null}]};
    }
    if (sql.includes('FROM notifiche_demos')) {
      // If the real query ever authorizes based on title instead of recipient,
      // these synthetic rows deliberately expose the leak in the test.
      const safe = sql.includes('WHERE (id_utente IS NULL OR id_utente = $1::uuid)');
      const rows = safe ? notices.filter(x=>x.id_utente===null||x.id_utente===values[0]) : notices;
      const count = sql.includes('LIMIT 1') ? 1 : 50;
      return {rows:rows.slice().sort((a,b)=>b.data_creazione.localeCompare(a.data_creazione)).slice(0,count)};
    }
    if (sql.includes('FROM segnalazioni')) throw Error('Admin privileges incorrectly inferred');
    // No fixtures for unrelated notification categories or metadata tables.
    return {rows:[]};
  }
};

const modPaths = [
  '../config/database', '../middleware/auth',
  '../services/civicPushTopics', '../services/civicPushDeliveryGuard',
  '../routes/notifiche'
].map(file=>require.resolve(file));
const oldModules = modPaths.map(id=>[id,require.cache[id]]);
function inject(i,exports){
  const id=modPaths[i];require.cache[id]={id,filename:id,loaded:true,exports};
}
inject(0,{getPool:()=>db});
inject(1,{
  verifyToken(req,res,next) {
    const token=req.headers.authorization;
    const id=token==='Bearer a'?A:token==='Bearer b'?B:null;
    if(!id)return res.status(401).json({success:false,error:'Unauthorized'});
    // Legacy role is deliberately AD to prove only verified isAdmin grants access.
    req.user={id,role:'AD',isAdmin:false};next();
  },
  requireAdmin:(_req,res)=>res.sendStatus(403)
});
inject(2,{
  isCivicPushEnabled:()=>false,
  reconcileCivicTopicsForUser:async()=>({enabled:false,tokens:0}),
  unsubscribeDisabledCivicTopicsForUser:async()=>({enabled:false})
});
inject(3,{withCivicPushDeliveryLock:async(_pool,fn)=>fn(db)});
delete require.cache[modPaths[4]];

const app=express();app.use(express.json());
app.use('/api/notifiche',require('../routes/notifiche'));
let server;
async function request(endpoint,token='a') {
  if(!server){
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  }
  return new Promise((resolve,reject)=>{
    const req=http.get({hostname:'127.0.0.1',port:server.address().port,
      path:endpoint,headers:{authorization:'Bearer '+token}},res=>{
      let text='';res.setEncoding('utf8');res.on('data',chunk=>text+=chunk);
      res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(text),text});}
      catch(e){reject(e);}});
    });
    req.on('error',reject);
  });
}
after(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  for(const [id,entry] of oldModules){
    if(entry)require.cache[id]=entry;else delete require.cache[id];
  }
});
test('anonymous requests to feed and latest cannot reach SQL',async()=>{
  queries.length=0;
  assert.equal((await request('/api/notifiche','none')).status,401);
  assert.equal((await request('/api/notifiche/ultima','none')).status,401);
  assert.equal(queries.length,0);
});

test('private Demos feed is recipient-gated regardless of notification title',async()=>{
  queries.length=0;
  const a=await request('/api/notifiche?user_id='+B);
  assert.equal(a.status,200);
  assert.equal(a.body.success,true);
  const textA=JSON.stringify(a.body.notifiche);
  assert.match(textA,/PRIVATE_A_ONLY/);
  assert.match(textA,/Globale/);
  assert.doesNotMatch(textA,/PRIVATE_B_ONLY/);
  const b=await request('/api/notifiche?user_id='+A,'b');
  assert.equal(b.status,200);
  const textB=JSON.stringify(b.body.notifiche);
  assert.match(textB,/PRIVATE_B_ONLY/);
  assert.match(textB,/Globale/);
  assert.doesNotMatch(textB,/PRIVATE_A_ONLY/);
  const demosQueries=queries.filter(q=>q.sql.includes('FROM notifiche_demos'));
  assert.equal(demosQueries.length,2);
  assert.ok(demosQueries.every(q=>q.sql.includes('WHERE (id_utente IS NULL OR id_utente = $1::uuid)')));
  assert.deepEqual(demosQueries.map(q=>q.values[0]),[A,B]);
  assert.ok(!queries.some(q=>q.sql.includes('FROM segnalazioni')),
    'role text alone cannot grant admin report access');
});

test('latest endpoint applies the same private recipient gate for both accounts',async()=>{
  const a=await request('/api/notifiche/ultima','a');
  const b=await request('/api/notifiche/ultima','b');
  assert.equal(a.status,200);
  assert.equal(b.status,200);
  assert.equal(a.body.data.messaggio,'PRIVATE_A_ONLY');
  assert.equal(b.body.data.messaggio,'PRIVATE_B_ONLY');
});

test('connection failures redact secrets in feed and latest responses',async()=>{
  failDb=true;
  const a=await request('/api/notifiche','a');
  const b=await request('/api/notifiche/ultima','b');
  failDb=false;
  assert.equal(a.status,500);
  assert.equal(b.status,500);
  assert.doesNotMatch(a.text+b.text,/SECRET_DSN_FOR_TEST_ONLY|DATABASE_URL|DB_HOST|db_host|database_url_present/);
});

test('source includes both canonical recipient predicates and no title-based auth',()=>{
  const src=fs.readFileSync(path.resolve(__dirname,'../routes/notifiche.js'),'utf8');
  const target='WHERE (id_utente IS NULL OR id_utente = $1::uuid)';
  assert.equal(src.split(target).length-1,2);
  assert.doesNotMatch(src,/titolo NOT LIKE 'DEMOS — %'/);
  assert.match(src,/const isAdmin = Boolean\(req\.user\?\.isAdmin\)/);
  assert.doesNotMatch(src,/console\.error\([^\n]+, (?:err|error)\)/);
});
