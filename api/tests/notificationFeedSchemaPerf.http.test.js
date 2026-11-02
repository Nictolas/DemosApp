'use strict';

// Actual Express feed handler, synthetic users and DB results. No external services.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const calls = [];
const notices = [
  { id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id_utente:null, titolo:'Informazione pubblica', testo:'Globale', data_creazione:'2026-11-02T00:00:00Z' },
  { id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id_utente:A, titolo:'Solo A', testo:'Riservata A', data_creazione:'2026-11-02T00:01:00Z' },
  { id:'cccccccc-cccc-4ccc-8ccc-cccccccccccc', id_utente:B, titolo:'Solo B', testo:'Riservata B', data_creazione:'2026-11-02T00:02:00Z' }
];
const fakePool = { async query(statement, values=[]) {
  const sql=String(statement);
  calls.push({sql,values});
  if (sql.includes('FROM users WHERE id = $1')) {
    return { rows:[{ comune_residenza:values[0] === B ? 'Pisa' : null,
      rappresentante_camera:null,rappresentante_senato:null,rappresentante_comune:null }] };
  }
  if (sql.includes('information_schema.columns')) {
    if (values[0] === 'notifiche_comunali') return { rows:
      ['id','id_utente','titolo','testo','data','comune_residenza'].map(column_name=>({column_name})) };
    if (values[0] === 'notifiche_avvistamenti') return { rows:
      ['id','id_utente','tipo_avvistamento','comune_residenza','data_creazione'].map(column_name=>({column_name})) };
    throw new Error('Unexpected unparametrized schema lookup');
  }
  if (/FROM notifiche_demos/.test(sql)) {
    assert.ok(sql.includes('WHERE (id_utente IS NULL OR id_utente = $1::uuid)'), 'owner isolation missing');
    return { rows: notices.filter(n=>n.id_utente===null||n.id_utente===values[0]) };
  }
  if (/FROM notifiche_avvistamenti/.test(sql)) {
    assert.deepEqual(values, ['Pisa'], 'sightings constrained to authenticated municipal residence');
    return { rows:[{ id:'dddddddd-dddd-4ddd-8ddd-dddddddddddd',
      tipo_avvistamento:'Animale', comune_residenza:'Pisa', data_creazione:'2026-11-02T00:03:00Z' }] };
  }
  if (/FROM notifiche_comunali/.test(sql)) return {rows:[]};
  return { rows:[] };
}};

const dbId = require.resolve('../config/database');
const authId = require.resolve('../middleware/auth');
const routeId = require.resolve('../routes/notifiche');
const original = [dbId,authId,routeId].map(id=>[id,require.cache[id]]);
require.cache[dbId]={id:dbId,filename:dbId,loaded:true,exports:{getPool:()=>fakePool}};
require.cache[authId]={id:authId,filename:authId,loaded:true,exports:{
  verifyToken(req,res,next) {
    const token=req.headers.authorization;
    const id=token==='Bearer a'?A:token==='Bearer b'?B:null;
    if(!id)return res.status(401).json({success:false,error:'Unauthorized'});
    req.user={id,isAdmin:false};next();
  },
  requireAdmin:(_req,res)=>res.sendStatus(403)
}};
delete require.cache[routeId];
const app=express();
app.use('/api/notifiche',require('../routes/notifiche'));
let server;
async function request(token='a') {
  if(!server) {
    server=http.createServer(app);
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  }
  return new Promise((resolve,reject)=>{
    const req=http.get({host:'127.0.0.1',port:server.address().port,
      path:'/api/notifiche',headers:{authorization:'Bearer '+token}},res=>{
      let body='';
      res.setEncoding('utf8');res.on('data',part=>{body+=part;});
      res.on('end',()=>{try{resolve({status:res.statusCode,body:JSON.parse(body)});}catch(err){reject(err);}});
    });
    req.on('error',reject);
  });
}
after(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  for(const [id,entry] of original){if(entry)require.cache[id]=entry;else delete require.cache[id];}
});

test('no unauthenticated access or SQL read to the notification feed',async()=>{
  calls.length=0;
  const result=await request('invalid');
  assert.equal(result.status,401);
  assert.equal(calls.length,0);
});

test('separate accounts do not see private notices or unrelated sightings',async()=>{
  calls.length=0;
  const a=await request('a');
  assert.equal(a.status,200);
  assert.equal(a.body.success,true);
  assert.ok(a.body.notifiche.some(x=>x.messaggio==='Globale'));
  assert.ok(a.body.notifiche.some(x=>x.messaggio==='Riservata A'));
  assert.ok(!a.body.notifiche.some(x=>x.messaggio==='Riservata B'));
  assert.ok(!a.body.notifiche.some(x=>x.tipo_notifica==='avvistamento'));
  assert.equal(calls.filter(x=>x.sql.includes('information_schema.columns')).length,1,
    'without municipality only municipal columns are queried');
  assert.ok(!calls.some(x=>x.sql.includes('FROM notifiche_avvistamenti')));

  const b=await request('b');
  assert.equal(b.status,200);
  assert.ok(b.body.notifiche.some(x=>x.messaggio==='Riservata B'));
  assert.ok(!b.body.notifiche.some(x=>x.messaggio==='Riservata A'));
  assert.ok(b.body.notifiche.some(x=>x.tipo_notifica==='avvistamento'));
  assert.equal(calls.filter(x=>x.sql.includes('information_schema.columns')).length,2,
    'municipal metadata reused, sightings metadata fetched once');

  const repeat=await request('b');
  assert.equal(repeat.status,200);
  assert.equal(calls.filter(x=>x.sql.includes('information_schema.columns')).length,2,
    'subsequent feed requests reuse the schema cache');
  assert.ok(calls.filter(x=>x.sql.includes('FROM notifiche_avvistamenti')).every(x=>x.values[0]==='Pisa'));
});
