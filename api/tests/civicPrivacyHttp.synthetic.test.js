'use strict';
// Synthetic-only HTTP tests. No Supabase credentials, network DB, or real accounts.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const globalRow = { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id_utente: null, titolo: 'Avviso pubblico', testo: 'Informazione per tutti', data_creazione: '2026-10-31T13:00:00Z' };
const privateA = { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id_utente: A, titolo: 'Messaggio riservato', testo: 'Solo utente A', data_creazione: '2026-10-31T13:02:00Z' };
const privateB = { id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', id_utente: B, titolo: 'DEMOS — Messaggio personale', testo: 'Solo utente B', data_creazione: '2026-10-31T13:01:00Z' };
const syntheticNotices = [globalRow, privateA, privateB];
const reactions = [];

const fakePool = {
  async query(statement, values = []) {
    const sql = String(statement);
    // The production route checks information_schema before querying Demos notices.
    if (sql.includes("WHERE table_name = 'notifiche_demos'")) {
      return { rows: [{column_name:'titolo'},{column_name:'testo'}] };
    }
    if (sql.includes('FROM users WHERE id = $1')) {
      return { rows: [{ id: values[0], comune_residenza: null, rappresentante_camera: null, rappresentante_senato: null, rappresentante_comune: null }] };
    }
    if (sql.includes('FROM notifiche_demos')) {
      // Emulate SQL WHERE ownership (and reveal leaks when a regression removes it).
      const ownership = sql.includes('id_utente IS NULL OR id_utente = $1::uuid');
      const rows = ownership ? syntheticNotices.filter(x => x.id_utente === null || x.id_utente === values[0]) : syntheticNotices;
      return { rows: rows.slice().sort((a,b)=>b.data_creazione.localeCompare(a.data_creazione)) };
    }
    if (sql.startsWith('SELECT id, tipo FROM reazioni')) {
      return { rows: reactions.filter(x=>x.comunicazione_id===values[0] && x.utente_id===values[1]).map(x=>({id:x.id,tipo:x.tipo})) };
    }
    if (sql.startsWith('INSERT INTO reazioni')) {
      const x={id:'synthetic-'+(reactions.length+1),comunicazione_id:values[0],utente_id:values[1],tipo:values[2]};
      reactions.push(x); return { rows:[x] };
    }
    if (sql.startsWith('DELETE FROM reazioni')) {
      const n=reactions.findIndex(x=>x.comunicazione_id===values[0] && x.utente_id===values[1]);
      if(n>=0)reactions.splice(n,1);
      return {rowCount:n>=0?1:0, rows:[]};
    }
    if (sql.startsWith('UPDATE reazioni')) {
      const x=reactions.find(z=>z.comunicazione_id===values[1] && z.utente_id===values[2]);
      if(x)x.tipo=values[0]; return {rowCount:x?1:0, rows:[]};
    }
    if (sql.includes('COUNT(*)::int as count') && sql.includes('FROM reazioni')) {
      const bucket = [];
      for(const x of reactions.filter(z=>values[0].includes(z.comunicazione_id))){
        const rec=bucket.find(z=>z.comunicazione_id===x.comunicazione_id && z.tipo===x.tipo);
        if(rec)rec.count++;else bucket.push({comunicazione_id:x.comunicazione_id,tipo:x.tipo,count:1});
      }
      return {rows:bucket};
    }
    if (sql.includes('WHERE utente_id = $1 AND comunicazione_id = ANY')) {
      return { rows: reactions.filter(x=>x.utente_id===values[0] && values[1].includes(x.comunicazione_id)).map(x=>({comunicazione_id:x.comunicazione_id,tipo:x.tipo})) };
    }
    if (sql.includes('SELECT tipo FROM reazioni WHERE utente_id = $1')) {
      return {rows: reactions.filter(x=>x.utente_id===values[0] && x.comunicazione_id===values[1]).map(x=>({tipo:x.tipo}))};
    }
    if (sql.includes('GROUP BY tipo') && sql.includes('FROM reazioni')) {
      return {rows:['like','dislike'].map(tipo=>({tipo,count:String(reactions.filter(x=>x.comunicazione_id===values[0] && x.tipo===tipo).length)}))};
    }
    // Unrelated feed categories have no synthetic fixtures.
    return {rows:[]};
  },
};

// Intercept only the DB and authorization dependencies before loading real routers.
const dbPath = require.resolve('../config/database');
const authPath = require.resolve('../middleware/auth');
require.cache[dbPath] = {id:dbPath,filename:dbPath,loaded:true,exports:{getPool:()=>fakePool}};
const verifyToken=(req,res,next)=>{
  const bearer=req.headers.authorization;
  const id=bearer==='Bearer synthetic-a'?A:bearer==='Bearer synthetic-b'?B:null;
  if(!id)return res.status(401).json({success:false,error:'Token richiesto'});
  req.user={id,isAdmin:false,role:'U'};req.userId=id;next();
};
require.cache[authPath] = {id:authPath,filename:authPath,loaded:true,exports:{verifyToken, requireAdmin:(req,res,next)=>req.user?.isAdmin?next():res.sendStatus(403),pool:fakePool}};
const app=express();
app.use(express.json());
app.use('/api/notifiche',require('../routes/notifiche'));
app.use('/api/reazioni-comunicazioni',require('../routes/reazioni-comunicazioni'));
const server=http.createServer(app);
let base;
async function ready(){
  if(base)return;
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  base='http://127.0.0.1:'+server.address().port;
}
after(async()=>{if(server.listening)await new Promise(resolve=>server.close(resolve));});
async function call(endpoint, user, method='GET', body=null){
  await ready();
  const headers={...(user?{authorization:'Bearer synthetic-'+user}:{}),...(body?{'content-type':'application/json'}:{})};
  return fetch(base+endpoint,{method,headers,body:body?JSON.stringify(body):undefined});
}

test('notifiche feed and latest never disclose another recipient, including non-DEMOS titles',async()=>{
  const unauth=await call('/api/notifiche',null);
  assert.equal(unauth.status,401);
  for(const [person,own,other] of [['a',privateA,privateB],['b',privateB,privateA]]){
    const r=await call('/api/notifiche',person);
    assert.equal(r.status,200,'GET feed status');
    const text=JSON.stringify(await r.json());
    assert.ok(text.includes(own.testo),'must include own message');
    assert.ok(text.includes(globalRow.testo),'must include global message');
    assert.ok(!text.includes(other.testo),'must exclude other user message');
    const last=await call('/api/notifiche/ultima',person);
    assert.equal(last.status,200);
    const detail=JSON.stringify(await last.json());
    assert.ok(!detail.includes(other.testo),'latest must exclude other recipient');
  }
});

test('reactions require authentication and ignore impersonated user_id',async()=>{
  const uri='/api/reazioni-comunicazioni';
  assert.equal((await call(uri,null,'POST',{comunicazione_id:'fixture',utente_id:B,tipo:'like'})).status,401);
  const inserted=await call(uri,'a','POST',{comunicazione_id:'fixture',utente_id:B,tipo:'like'});
  assert.equal(inserted.status,200);
  const own=await call(uri+'/user/'+A+'/fixture','a');assert.equal(own.status,200);
  assert.equal((await own.json()).data,'like');
  const b=await call(uri+'/user/'+B+'/fixture','b');assert.equal((await b.json()).data,null);
  const aggregate=await call(uri+'/fixture',null);assert.equal(aggregate.status,200);
  assert.equal((await aggregate.json()).data.likes,1);
});

test('reactions never reveal or alter another account personal preferences',async()=>{
  const prefix='/api/reazioni-comunicazioni';
  assert.equal((await call(prefix+'/user/'+B+'/fixture','a')).status,403);
  assert.equal((await call(prefix+'/user/'+B+'/batch?ids=fixture','a')).status,403);
  assert.equal((await call(prefix+'/user/'+A+'/fixture',null)).status,401);
  assert.equal((await call(prefix+'/user/'+A+'/batch?ids=fixture',null)).status,401);
  const batch=await call(prefix+'/user/'+A+'/batch?ids=fixture','a');assert.equal(batch.status,200);
  assert.equal((await batch.json()).data.fixture,'like');
  const changed=await call(prefix,'a','POST',{comunicazione_id:'fixture',utente_id:B,tipo:'dislike'});
  assert.equal(changed.status,200);
  const afterB=await call(prefix+'/user/'+B+'/fixture','b');assert.equal((await afterB.json()).data,null);
  const afterA=await call(prefix+'/user/'+A+'/fixture','a');assert.equal((await afterA.json()).data,'dislike');
});

test('notification logs and HTTP failures never expose private titles or SQL secrets', async () => {
  const originalQuery = fakePool.query;
  const originalConsole = {};
  const records = [];
  for (const level of ['log', 'info', 'warn', 'error']) {
    originalConsole[level] = console[level];
    console[level] = (...args) => records.push(args.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
  }
  try {
    const latest = await call('/api/notifiche/ultima', 'a');
    assert.equal(latest.status, 200);
    assert.equal((await latest.json()).data.titolo, privateA.titolo);
    assert.doesNotMatch(JSON.stringify(records), /Messaggio riservato|Solo utente A/);

    const secret = 'PRIVATE_DSN_TOKEN_DO_NOT_LOG';
    fakePool.query = async () => {
      const error = new Error(secret);
      error.code = 'ECONNREFUSED';
      error.detail = secret;
      throw error;
    };
    const feed = await call('/api/notifiche', 'a');
    assert.equal(feed.status, 500);
    assert.doesNotMatch(await feed.text(), /PRIVATE_DSN_TOKEN|DATABASE_URL|DB_HOST|database_url_present|db_host/);

    const preferences = await call('/api/notifiche/preferenze', 'a');
    assert.equal(preferences.status, 500);
    assert.doesNotMatch(await preferences.text(), /PRIVATE_DSN_TOKEN|DATABASE_URL|DB_HOST/);

    const preferencesSave = await call('/api/notifiche/preferenze', 'a', 'POST', {
      preferenze: { demos: true, animali: false }
    });
    assert.equal(preferencesSave.status, 500);
    assert.doesNotMatch(await preferencesSave.text(), /PRIVATE_DSN_TOKEN|DATABASE_URL|DB_HOST/);

    const newest = await call('/api/notifiche/ultima', 'a');
    assert.equal(newest.status, 500);
    assert.doesNotMatch(await newest.text(), /PRIVATE_DSN_TOKEN|DATABASE_URL|DB_HOST/);
    assert.doesNotMatch(JSON.stringify(records), /PRIVATE_DSN_TOKEN|Messaggio riservato|Solo utente A/);
  } finally {
    fakePool.query = originalQuery;
    for (const [level, fn] of Object.entries(originalConsole)) console[level] = fn;
  }
});
