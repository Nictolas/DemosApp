'use strict';
// Loopback HTTP integration for public-directory privacy. No real users, DB, or remote calls.
const {test, after} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const marker='private-synthetic@example.invalid';
const injectedProfile={
  id:'11111111-1111-4111-8111-111111111111',
  nome:'Persona', cognome:'Sintetica', ruolo:'A', supporters_count:4,
  regione_residenza:'TO', facebook_url:'https://example.org/public',
  avatar_config:JSON.stringify({
    hairColor:'#123456',hairStyle:'short',privateEmail:marker,
    reviewMetadata:{secret:marker}
  }),
  tipologie_attivismo:[{
    tipo:'ambiente',nome:'Esempio',descrizione:'Pubblico',email:marker,
    moderation_note:marker
  }],
  email:marker,genere:'F',data_nascita:'1990-01-01',
  cittadinanza:marker,paese_residenza:marker,provincia_residenza:marker,
  comune_residenza:marker,created_at:'2026-01-01',
  updated_at:'2026-02-01',status:'a',private_note:marker
};
let fail=false;
const queries=[];
const forbidden=/(?:^|[^\w])(?:u\.)?(?:email|genere|data_nascita|cittadinanza|paese_residenza|provincia_residenza|comune_residenza|status|created_at|updated_at)(?:[^\w]|$)/i;

const fakePool={
  async query(statement, values=[]) {
    const sql=String(statement);queries.push({sql,values});
    assert.match(sql,/^\s*SELECT\b/i,'no writes');
    if(fail) throw new Error('private-sql-error '+marker);
    if(sql.includes('FROM users u')){
      const projection=sql.match(/^\s*SELECT\s+([\s\S]*?)\s+FROM users u\b/i)?.[1];
      assert.ok(projection,'user profile list must use an explicit SELECT');
      assert.doesNotMatch(projection,forbidden,
        'private columns must not be read even when public projector removes them');
      assert.match(sql,/u\.status\s*=\s*'a'/,
        'suspended accounts must be filtered by the database');
      return {rows:[injectedProfile]};
    }
    return {rows:[]};
  }
};
const db=require.resolve('../config/database');
const capabilities=require.resolve('../services/accountCapabilitiesService');
require.cache[db]={id:db,filename:db,loaded:true,exports:{getPool:()=>fakePool}};
require.cache[capabilities]={
  id:capabilities,filename:capabilities,loaded:true,
  exports:{
    queryWithAccountModelFallback:(_pool,modernSql,legacySql,values)=>{
      assert.match(legacySql,/u\.status\s*=\s*'a'/,
        'legacy account schema must also hide suspended accounts');
      return fakePool.query(modernSql,values);
    }
  }
};

const app=express();
app.use('/api/attivisti',require('../routes/attivisti'));
app.use('/api/organizzazioni',require('../routes/organizzazioni'));
const server=http.createServer(app);
let origin;
async function call(path) {
  if(!origin) {
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    origin='http://127.0.0.1:'+server.address().port;
  }
  return fetch(origin+path);
}
after(async()=>{if(server.listening)await new Promise(resolve=>server.close(resolve));});

const routes=[
  '/api/attivisti',
  '/api/attivisti/tipologia/ambiente',
  '/api/organizzazioni'
];

for(const route of routes){
  test('HTTP '+route+' has minimal uncached response and minimal SELECT',async()=>{
    const before=queries.length;
    const res=await call(route);
    assert.equal(res.status,200);
    assert.match(res.headers.get('cache-control')||'',/no-store/);
    const obj=await res.json();
    assert.equal(obj.success,true);
    assert.equal(obj.count,1);
    assert.equal(obj.data.length,1);
    const profile=obj.data[0];
    assert.deepEqual(Object.keys(profile).sort(),[
      'id','nome','cognome','ruolo','supporters_count','regione_residenza',
      'facebook_url','avatar_config','tipologie_attivismo'
    ].sort());
    assert.deepEqual(JSON.parse(profile.avatar_config),{
      hairColor:'#123456',hairStyle:'short'
    });
    assert.deepEqual(profile.tipologie_attivismo,[{
      tipo:'ambiente',nome:'Esempio',descrizione:'Pubblico'
    }]);
    assert.doesNotMatch(JSON.stringify(obj),/private-synthetic|moderation_note|private_note|reviewMetadata/);
    assert.equal(queries.length,before+1,'one database read per directory in this fixture');
  });
}
test('database failure never reflects private SQL errors to HTTP clients',async()=>{
  fail=true;
  try{
    for(const route of routes){
      const response=await call(route);
      assert.equal(response.status,500,route);
      assert.match(response.headers.get('cache-control')||'',/no-store/);
      assert.doesNotMatch(JSON.stringify(await response.json()),/private-sql-error|private-synthetic/);
    }
  }finally{fail=false;}
});
