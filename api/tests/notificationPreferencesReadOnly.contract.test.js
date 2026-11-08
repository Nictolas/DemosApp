'use strict';
// No database or personal fixture: run the exact GET block in an isolated VM.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../routes/notifiche.js'),'utf8');
const start = source.indexOf('// GET /api/notifiche/preferenze');
const end = source.indexOf('// POST /api/notifiche/preferenze',start);
assert.ok(start>=0 && end>start,'GET preferences route section must be present');
const part = source.slice(start,end);
assert.doesNotMatch(part,/\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\s+(?:INTO|TABLE|FROM|notifiche_preferenze)\b/i,
  'GET preferences must not mutate database, including on first access');
assert.match(part,/router\.get\('\/preferenze'/);
assert.match(part,/Cache-Control', 'no-store'/);
assert.doesNotMatch(part,/details\s*:\s*error\.|console\.error\([^\n]*,\s*error/,
  'Do not expose raw SQL or runtime error details');

function makeHandler(dbQuery) {
  let handler;
  const router = {get(path,...args){ assert.equal(path,'/preferenze'); handler=args.at(-1); }};
  vm.runInNewContext(part,{router,verifyToken:()=>{},pool:{query:dbQuery},console:{error(){}},Object});
  assert.equal(typeof handler,'function');
  return handler;
}
function makeResponse() {
  return {
    headers:{},statusCode:200,body:null,
    set(k,v){this.headers[k]=v;return this;},
    status(n){this.statusCode=n;return this;},
    json(v){this.body=v;return this;}
  };
}
test('anonymous page opening never creates a preference row and civic choices default off',async()=>{
  const queries=[];
  const handler=makeHandler(async(sql,params)=>{
    queries.push({sql:String(sql),params});
    return {rows:[]};
  });
  const res=makeResponse();
  await handler({user:{id:'synthetic-reader'}},res);
  assert.equal(res.statusCode,200);
  assert.equal(res.headers['Cache-Control'],'no-store');
  assert.equal(queries.length,1);
  assert.match(queries[0].sql,/^\s*SELECT\b/i);
  assert.deepEqual(Array.from(queries[0].params),['synthetic-reader']);
  assert.equal(res.body.success,true);
  assert.equal(res.body.data.preferenze.iniziative_popolari,false);
  assert.equal(res.body.data.preferenze.referendum_abrogativi,false);
  assert.equal(res.body.data.preferenze.eci,false);
  assert.equal(res.body.data.updated_at,null);
});
test('existing saved civic consent is displayed without side-effect or mutation',async()=>{
  let called=0;
  const handler=makeHandler(async sql=>{
    called++;
    assert.match(sql,/^\s*SELECT\b/i);
    return {rows:[{animali:false,attivisti:true,iniziative_popolari:true,
      referendum_abrogativi:false,eci:true,updated_at:'synthetic-time'}]};
  });
  const res=makeResponse();
  await handler({user:{id:'synthetic-reader'}},res);
  assert.equal(called,1);
  assert.equal(res.body.data.preferenze.iniziative_popolari,true);
  assert.equal(res.body.data.preferenze.eci,true);
  assert.equal(res.body.data.preferenze.animali,false);
  assert.equal(res.body.data.updated_at,'synthetic-time');
});
test('database failure does not expose SQL details or personal information',async()=>{
  const handler=makeHandler(async()=>{throw new Error('PRIVATE_DB_CONTEXT synthetic only')});
  const res=makeResponse();
  await handler({user:{id:'synthetic-reader'}},res);
  assert.equal(res.statusCode,500);
  assert.equal(res.body.success,false);
  assert.doesNotMatch(JSON.stringify(res.body),/PRIVATE_DB_CONTEXT|synthetic-reader/);
});
