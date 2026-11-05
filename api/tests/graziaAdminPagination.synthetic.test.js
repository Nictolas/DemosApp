'use strict';
// Synthetic-only test: execute actual Grazia router functions with fake SQL.
// No database, external HTTP, personal data, or application secrets.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const root=path.resolve(__dirname,'..','..');
const source=fs.readFileSync(path.join(root,'api/routes/grazia.js'),'utf8');
const routes=new Map();
const sqlCalls=[];
const UUID=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0');
const EPOCH='1793883600.123456';
const published=Array.from({length:105},(_,i)=>({
  id:UUID(105-i),nome:'Persona sintetica '+(105-i),
  createdAt:'2026-11-05T13:00:00Z',cursor_epoch:EPOCH
}));
const withdrawals=Array.from({length:108},(_,i)=>({
  id:UUID(108-i),withdrawn_at:'2026-11-05T13:00:00Z',
  cursor_epoch:EPOCH
}));
const pending=Array.from({length:107},(_,i)=>({
  id:UUID(i+1),nome:'Candidato sintetico '+(i+1),
  urlProva:'https://example.org/official',
  createdAt:'2026-11-05T13:00:00Z',cursor_epoch:EPOCH
}));
const pool={
  async query(sql,params=[]){
    sqlCalls.push({sql,params});
    if (sql.includes("FROM richieste_grazia WHERE status = 'pending' ORDER BY data_creazione ASC LIMIT 100"))
      return {rows:pending.slice(0,100).map(({cursor_epoch,...x})=>x)};
    const approved=sql.includes("status='approved' AND withdrawn_at IS NULL");
    const audit=sql.includes("withdraw_notification_sent IS DISTINCT FROM TRUE");
    const waiting=sql.includes("status='pending'");
    assert.ok(approved||audit||waiting,'unexpected SQL query');
    const direction=waiting?'ASC':'DESC';
    assert.ok(sql.includes('ORDER BY '+(audit?'withdrawn_at':'data_creazione')+' '+direction+', id '+direction+' LIMIT 101'));
    assert.match(sql,/EXTRACT\(EPOCH FROM (data_creazione|withdrawn_at)\)::text AS cursor_epoch/);
    assert.match(sql,/\(\$1::numeric IS NULL OR \((data_creazione|withdrawn_at),id::text\) [<>] \(to_timestamp\(\$1::numeric\),\$2::text\)\)/);
    assert.doesNotMatch(sql,/\$2::uuid/,'legacy Grazia identifiers are varchar, not uuid');
    assert.doesNotMatch(sql,/proposer_user_id|utente_id|withdraw_note|voti_grazia/i);
    if(!waiting)assert.doesNotMatch(sql,/url_prova/i);
    const fixture=waiting?pending:approved?published:withdrawals;
    const filtered=params[0]==null?fixture:fixture.filter(x=>waiting?x.id>params[1]:x.id<params[1]);
    return {rows:filtered.slice(0,101)};
  }
};
const noop=(_req,_res,next)=>next();
const mocks={
  express:{Router:()=>({get:(route,...fns)=>routes.set(route,fns),post:()=>{}})},
  crypto:{randomUUID:()=>UUID(500)},
  '../utils/recognitionEvidence':{validateEvidenceUrl:()=>null},
  '../middleware/auth':{verifyToken:noop,requireAdmin:noop,pool},
  '../middleware/politicalConsent':{requirePoliticalConsent:noop},
  '../middleware/civicIdentity':{requireVerifiedCivicIdentity:noop},
  '../middleware/validation':{validateInput:()=>noop},
  '../services/preferenceCooldownService':{
    getPreferenceCooldown:()=>null,assertPreferenceChangeAllowed:()=>{},
    recordPreferenceChange:()=>{},sendCooldownError:()=>false,
  },
};
const mod={exports:{}};
vm.runInNewContext(source,{
  module:mod,require:name=>{
    if(!(name in mocks))throw Error('unexpected module '+name);
    return mocks[name];
  },Buffer,URL,console,
},{filename:'grazia.js'});
async function invoke(route,cursor,legacy=false){
  const stack=routes.get(route);
  assert.equal(stack.length,4,'private cache + authenticated Admin required');
  const req={query:{...(route==='/richieste'&&!legacy?{paged:'1'}:{}),...(cursor===undefined?{}:{cursor})}};
  const res={
    code:200,headers:{},body:null,
    set(name,value){this.headers[name]=value;return this;},
    status(code){this.code=code;return this;},
    json(body){this.body=body;return this;},
  };
  for(const middleware of stack.slice(0,-1)){
    let nextCalled=false;
    await middleware(req,res,()=>{nextCalled=true});
    assert.ok(nextCalled);
  }
  await stack.at(-1)(req,res);
  assert.match(res.headers['Cache-Control'],/no-store/);
  return res;
}

for (const [route,key,count] of [
  ['/richieste','richieste',107],
  ['/approvate','richieste',105],
  ['/ritiri-avvisi','ritiri',108],
]){
  test(route+' exposes every page beyond the first 100 despite identical timestamps',async()=>{
    const initial=await invoke(route);
    assert.equal(initial.code,200);
    assert.equal(initial.body.success,true);
    assert.equal(initial.body[key].length,100);
    assert.equal(typeof initial.body.next_cursor,'string');
    const decoded=JSON.parse(Buffer.from(initial.body.next_cursor,'base64url').toString('utf8'));
    assert.equal(decoded[0],EPOCH,'must keep microseconds in DB cursor');
    assert.equal(decoded[1],UUID(route==='/richieste'?100:count-99));
    const follow=await invoke(route,initial.body.next_cursor);
    assert.equal(follow.code,200);
    assert.equal(follow.body[key].length,count-100);
    assert.equal(follow.body.next_cursor,null);
    const all=[...initial.body[key],...follow.body[key]];
    assert.equal(new Set(all.map(x=>x.id)).size,count);
    assert.equal(all.at(-1).id,UUID(route==='/richieste'?count:1));
    for(const row of all){
      assert.ok(!('cursor_epoch' in row));
      assert.ok(!('utente_id' in row));
      assert.ok(!('url_prova' in row));
      assert.ok(!('withdraw_note' in row));
      assert.ok(!('proposer_user_id' in row));
    }
  });
  test(route+' rejects malformed/oversized cursors without SQL',async()=>{
    for(const bad of ['*', 'A'.repeat(241),
      Buffer.from(JSON.stringify(['999999999999','not-a-uuid'])).toString('base64url'),
      Buffer.from(JSON.stringify([EPOCH,'not-a-uuid'])).toString('base64url'),
      Buffer.from('{}').toString('base64url')]){
      const before=sqlCalls.length;
      const r=await invoke(route,bad);
      assert.equal(r.code,400);
      assert.equal(sqlCalls.length,before);
      assert.equal(r.body.success,false);
    }
  });
}

test('legacy Admin pending endpoint keeps the original array response',async()=>{
  const r=await invoke('/richieste',undefined,true);
  assert.equal(r.code,200);
  assert.equal(Array.isArray(r.body),true);
  assert.equal(r.body.length,100);
  assert.ok(!('cursor_epoch' in r.body[0]));
});

test('Admin UI paginates all three listings and separates caches by account',()=>{
  const ui=fs.readFileSync(path.join(root,'client/src/pages/GestisciGrazia.tsx'),'utf8');
  assert.match(ui,/useInfiniteQuery/);
  assert.match(ui,/\/api\/grazia\/richieste\?paged=1/);
  assert.match(ui,/queryKey: \["graziaRequests", user\?\.id\]/);
  assert.match(ui,/queryKey: \["graziaApproved", user\?\.id\]/);
  assert.match(ui,/queryKey: \["graziaWithdrawalAudit", user\?\.id\]/);
  assert.match(ui,/fetchMoreRequests\(\)/);
  assert.match(ui,/enabled: !!user && isAdmin && showPublished/);
  assert.match(ui,/enabled: !!user && isAdmin && showUnconfirmed/);
  assert.match(ui,/encodeURIComponent\(pageParam\)/);
  assert.match(ui,/fetchMorePublished\(\)/);
  assert.match(ui,/fetchMoreUnconfirmed\(\)/);
  assert.match(ui,/isFetchingNextPage/);
  assert.match(ui,/queryClient\.invalidateQueries\(\{queryKey:\["graziaApproved"\]\}\)/);
  assert.match(ui,/queryClient\.invalidateQueries\(\{queryKey:\["graziaWithdrawalAudit"\]\}\)/);
});
