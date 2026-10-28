'use strict';
// Synthetic route tests: no HTTP listener, database, personal data or network.
const test = require('node:test');
const assert = require('node:assert/strict');

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

async function withMockedRoute(db, fn) {
  const dbPath = require.resolve('../config/db');
  const authPath = require.resolve('../middleware/auth');
  const routePath = require.resolve('../routes/user/gdpr-requests');
  const prior = [dbPath, authPath, routePath].map(path => require.cache[path]);
  try {
    require.cache[dbPath] = {
      id: dbPath, filename: dbPath, loaded: true, exports: {pool: db}
    };
    require.cache[authPath] = {
      id: authPath, filename: authPath, loaded: true,
      exports: {verifyToken(req, res, next) { next(); }}
    };
    delete require.cache[routePath];
    const router = require('../routes/user/gdpr-requests');
    const get = router.stack.find(layer => layer.route?.methods.get)?.route.stack.at(-1)?.handle;
    const post = router.stack.find(layer => layer.route?.methods.post)?.route.stack.at(-1)?.handle;
    assert.equal(typeof get, 'function');
    assert.equal(typeof post, 'function');
    await fn({get, post});
  } finally {
    for (const [i, path] of [dbPath, authPath, routePath].entries()) {
      delete require.cache[path];
      if (prior[i]) require.cache[path] = prior[i];
    }
  }
}

test('GDPR POST persists a real request ID via parameterized DPO table before 201', async () => {
  const calls = [];
  const pool = {
    async query(sql, args) {
      calls.push({sql, args});
      return {rows:[{
        id:'00000000-0000-4000-8000-000000000351',
        request_type:'erasure', status:'pending', created_at:'2026-10-28T00:00:00Z'
      }]};
    }
  };
  await withMockedRoute(pool, async ({post}) => {
    const res=response();
    await post({
      userId:'synthetic-user', body:{tipo:'erasure',dettagli:'synthetic private message'}
    },res);
    assert.equal(res.statusCode,201);
    assert.equal(res.body.success,true);
    assert.equal(res.body.data.stato,'pending');
    assert.equal(res.body.data.id,'00000000-0000-4000-8000-000000000351');
    assert.ok(!JSON.stringify(res.body).includes('synthetic private message'),
      'acknowledgment must not repeat private request contents');
  });
  assert.equal(calls.length,1);
  assert.match(calls[0].sql,/INSERT INTO public\.user_rights_requests/);
  assert.match(calls[0].sql,/ON CONFLICT \(id\) DO NOTHING/);
  assert.match(calls[0].sql,/RETURNING id, request_type, status, created_at/);
  assert.match(calls[0].args[0],/^[0-9a-f]{8}-[0-9a-f-]{27,}$/);
  assert.deepEqual(calls[0].args.slice(1,3),['synthetic-user','erasure']);
  assert.deepEqual(JSON.parse(calls[0].args[3]),
    {source:'gdpr_requests_api',details:'synthetic private message'});
});

test('GDPR Idempotency-Key retry returns same saved receipt without duplicate INSERT', async () => {
  const key='e5633efb-2d49-4bcb-99ee-37833470f54a';
  let calls=0;
  const pool={async query(sql,params){
    calls++;
    assert.equal(params[0],key);
    if(sql.startsWith('INSERT')) {
      return {rows:calls===1?[{id:key,request_type:'access',status:'pending',created_at:'2026-10-28T00:00:00Z'}]:[]};
    }
    assert.match(sql,/WHERE id=\$1::uuid AND user_id=\$2/);
    assert.deepEqual(params.slice(1,3),['user-1','access']);
    return {rows:[{id:key,request_type:'access',status:'processing',created_at:'2026-10-28T00:00:00Z'}]};
  }};
  await withMockedRoute(pool,async ({post})=>{
    const req={userId:'user-1',headers:{'idempotency-key':key},body:{tipo:'access',dettagli:'fixture'}};
    const one=response();await post(req,one);
    assert.equal(one.statusCode,201);
    const two=response();await post(req,two);
    assert.equal(two.statusCode,200);
    assert.equal(two.body.data.id,one.body.data.id);
    assert.equal(two.body.data.stato,'processing');
  });
  assert.equal(calls,3);
});

test('same Idempotency-Key with changed owner or payload never reveals another request', async () => {
  const key='e5633efb-2d49-4bcb-99ee-37833470f54a';
  let writes=0;
  const pool={async query(sql){
    if(sql.startsWith('INSERT')){writes++;return {rows:[]};}
    return {rows:[]};
  }};
  await withMockedRoute(pool,async ({post})=>{
    for(const req of [
      {userId:'another-user',headers:{'idempotency-key':key},body:{tipo:'access',dettagli:'fixture'}},
      {userId:'user-1',headers:{'idempotency-key':key},body:{tipo:'access',dettagli:'different'}}
    ]){
      const result=response();await post(req,result);
      assert.equal(result.statusCode,409);
      assert.equal(result.body.success,false);
      assert.equal(JSON.stringify(result.body).includes(key),false);
    }
  });
  assert.equal(writes,2);
});

test('invalid Idempotency-Key is refused before SQL',async()=>{
  let count=0;
  const pool={async query(){count++;throw Error('SQL should not run');}};
  await withMockedRoute(pool,async ({post})=>{
    for(const value of ['not-uuid','00000000-0000-0000-0000-000000000000',
      'e5633efb-2d49-4bcb-99ee-37833470f54a;DROP TABLE x']){
      const r=response();await post({
        userId:'user-1',headers:{'idempotency-key':value},
        body:{tipo:'access',dettagli:'fixture'}
      },r);
      assert.equal(r.statusCode,400);
      assert.equal(r.body.success,false);
    }
  });
  assert.equal(count,0);
});

test('both GDPR history endpoints share one bounded RLS-aware SQL statement and no payload', async () => {
  const calls=[];
  const db={async query(sql,args){
    calls.push({sql,args});
    assert.match(sql,/WITH visibility AS MATERIALIZED/);
    assert.match(sql,/LEFT JOIN LATERAL/);
    assert.doesNotMatch(sql,/request_data|response_data|processed_by/);
    return {rows:[{
      complete_visibility:true,id:'synthetic-id',request_type:'access',
      status:'pending',created_at:'2026-10-28T00:00:00Z',
      processed_at:null,request_data:{details:'private'}
    }]};
  }};
  await withMockedRoute(db,async ({get})=>{
    const res=response();
    await get({user:{id:'synthetic-user'},query:{}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.deepEqual(res.body.data,[{
      id:'synthetic-id',tipo:'access',stato:'pending',
      data_richiesta:'2026-10-28T00:00:00Z',data_elaborazione:null
    }]);
    assert.deepEqual(res.body.pagination,{
      limit:50,offset:0,has_more:false,next_offset:null
    });
    assert.doesNotMatch(JSON.stringify(res.body),/private/);
    assert.equal(calls.length,1);
    assert.deepEqual(calls[0].args,['synthetic-user',51,0]);
  });
});

test('legacy GDPR GET refuses RLS-filtered history and bad pagination before SQL',async()=>{
  let filtered=true;
  let calls=0;
  const db={async query(sql){
    calls++;
    assert.match(sql,/row_security_active/);
    return {rows:[{complete_visibility:!filtered,id:null}]};
  }};
  const oldLog=console.error;
  console.error=()=>{};
  try{
    await withMockedRoute(db,async ({get})=>{
      const denied=response();
      await get({userId:'synthetic-user',query:{}},denied);
      assert.equal(denied.statusCode,503);
      assert.equal(denied.body.success,false);
      assert.equal(calls,1);
      filtered=false;
      const empty=response();
      await get({userId:'synthetic-user',query:{}},empty);
      assert.equal(empty.statusCode,200);
      assert.deepEqual(empty.body.data,[]);
      assert.equal(calls,2);
      for(const query of [{limit:'9999'},{offset:'-1'},{status:'../../etc'},{limit:['1','2']}]) {
        const invalid=response();
        await get({userId:'synthetic-user',query},invalid);
        assert.equal(invalid.statusCode,400);
      }
      assert.equal(calls,2,'invalid page parameters must never query PostgreSQL');
    });
  }finally{console.error=oldLog;}
});

test('GDPR route rejects unauthenticated and invalid inputs before SQL', async () => {
  let sqlCalls=0;
  const pool={async query(){sqlCalls++;throw Error('must not query');}};
  await withMockedRoute(pool, async ({post,get}) => {
    const missing=response();
    await post({body:{tipo:'access'}},missing);
    assert.equal(missing.statusCode,401);
    const missingGet=response();
    await get({},missingGet);
    assert.equal(missingGet.statusCode,401);
    for(const body of [
      {},{tipo:'../../data'},{tipo:'e'.repeat(51)},
      {tipo:'access',dettagli:{raw:'invalid'}},
      {tipo:'access',dettagli:'X'.repeat(2001)}
    ]){
      const res=response();
      await post({userId:'synthetic-user',body},res);
      assert.equal(res.statusCode,400);
      assert.equal(res.body.success,false);
    }
  });
  assert.equal(sqlCalls,0);
});

test('failed PostgreSQL INSERT or missing RETURNING ID never fabricates success', async () => {
  let failMode='throw';
  const pool={async query(){
    if(failMode==='throw')throw Error('synthetic-database-unavailable');
    return {rows:[{status:'pending'}]};
  }};
  const originalLog=console.error;
  console.error=()=>{};
  try {
    await withMockedRoute(pool, async ({post,get}) => {
      const req={userId:'synthetic-user',body:{tipo:'access',dettagli:'private'}};
      for(const mode of ['throw','missing']) {
        failMode=mode;
        const res=response();
        await post(req,res);
        assert.equal(res.statusCode,503);
        assert.equal(res.body.success,false);
        assert.ok(!JSON.stringify(res.body).includes('private'));
        assert.ok(!JSON.stringify(res.body).includes('synthetic-database-unavailable'));
      }
      failMode='throw';
      const unavailable=response();
      await get({userId:'synthetic-user'},unavailable);
      assert.equal(unavailable.statusCode,503);
      assert.equal(unavailable.body.success,false);
      assert.notDeepEqual(unavailable.body,{success:true,data:[]});
    });
  }finally{console.error=originalLog;}
});

test('actual rights history is bounded, same-snapshot, payload-free and honestly paginated', async () => {
  const paths = [
    require.resolve('../middleware/auth'),
    require.resolve('../middleware/validation'),
    require.resolve('../services/auditService'),
    require.resolve('../utils/emailCrypto'),
    require.resolve('../routes/user/gdpr-rights')
  ];
  const previous = paths.map(path => require.cache[path]);
  let filtered = true;
  let reads = 0;
  const fakeRows = Array.from({length: 51}, (_, i) => ({
    complete_visibility: true,
    id: 'synthetic-' + i, request_type: 'access', status: 'pending',
    created_at: '2026-10-28T00:00:00Z', processed_at: null,
    request_data: { secret: 'must-not-escape' },
    response_data: { secret: 'DPO-internal' },
    processed_by: 'synthetic-internal-operator'
  }));
  const mockedPool = {async query(sql, params) {
    reads++;
    assert.match(sql,/WITH visibility AS MATERIALIZED/);
    assert.match(sql,/row_security_active/);
    assert.match(sql,/LEFT JOIN LATERAL/);
    assert.match(sql,/ORDER BY created_at DESC NULLS LAST, id DESC/);
    assert.doesNotMatch(sql,/request_data|response_data|processed_by/);
    assert.equal(params[0],'synthetic-subject');
    if (filtered) return {rows:[{complete_visibility:false,id:null}]};
    const offset = params.at(-1);
    assert.equal(params.at(-2),51,'fetch one extra row for honest has_more');
    return {rows:fakeRows.slice(offset,offset+51)};
  }};
  const originalLog = console.error;
  console.error = () => {};
  try {
    const modules = [
      {verifyToken(req,res,next){next();},pool:mockedPool},
      {validateInput(){return (req,res,next)=>next();}},
      {logAction:async()=>{},getUserAuditLogs:async()=>[]},
      {decrypt(value){return value;}},
      null
    ];
    for(let i=0;i<paths.length-1;i++)require.cache[paths[i]]={
      id:paths[i],filename:paths[i],loaded:true,exports:modules[i]
    };
    delete require.cache[paths[4]];
    const router=require('../routes/user/gdpr-rights');
    const layer=router.stack.find(x=>x.route?.path==='/rights-requests'&&x.route?.methods.get);
    assert.ok(layer);
    const get=layer.route.stack.at(-1).handle;
    const denied=response();
    await get({userId:'synthetic-subject',query:{}},denied);
    assert.equal(denied.statusCode,503);
    assert.equal(denied.body.success,false);
    assert.equal(reads,1);

    filtered=false;
    const page1=response();
    await get({userId:'synthetic-subject',query:{}},page1);
    assert.equal(page1.statusCode,200);
    assert.equal(page1.body.data.length,50);
    assert.deepEqual(page1.body.pagination,{
      limit:50,offset:0,has_more:true,next_offset:50
    });
    assert.doesNotMatch(JSON.stringify(page1.body),/must-not-escape|DPO-internal|synthetic-internal-operator/);
    assert.equal(page1.body.pagination.total,undefined,
      'page size must never be presented as total history');

    const page2=response();
    await get({userId:'synthetic-subject',query:{limit:'50',offset:'50'}},page2);
    assert.equal(page2.statusCode,200);
    assert.equal(page2.body.data.length,1);
    assert.deepEqual(page2.body.pagination,{
      limit:50,offset:50,has_more:false,next_offset:null
    });

    for(const query of [
      {limit:'0'},{limit:'51'},{limit:'1e3'},{limit:'2oops'},
      {limit:['1','2']},{offset:'-1'},{offset:'99999999'},
      {status:{bad:'input'}},{status:'../../etc'},{offset:'1.2'}
    ]) {
      const invalid=response();
      await get({userId:'synthetic-subject',query},invalid);
      assert.equal(invalid.statusCode,400);
    }
    assert.equal(reads,3,'invalid pagination must never query PostgreSQL');
    const unauthenticated=response();
    await get({query:{}},unauthenticated);
    assert.equal(unauthenticated.statusCode,401);
    assert.equal(reads,3);
  } finally {
    console.error=originalLog;
    for(let i=0;i<paths.length;i++){
      delete require.cache[paths[i]];
      if(previous[i])require.cache[paths[i]]=previous[i];
    }
  }
});

test('history UI is keyed by authenticated user, preventing cross-session stale results', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const file = fs.readFileSync(
    path.join(__dirname,'..','..','client','src','pages','GDPRRights.tsx'),
    'utf8'
  );
  // This is a static boundary contract; the separate Vite workflow
  // typechecks/transforms the actual TSX. No users, browser or provider I/O.
  assert.match(file, /const \{ user, isLoading \} = useAuth\(\)/);
  assert.match(file, /if \(!user\)\s*\{/);
  assert.match(file, /return <AuthenticatedRightsHistory key=\{user\.id\} \/>/);
  assert.match(file, /function AuthenticatedRightsHistory\(\)/);
  assert.match(file, /Accedi per consultare le tue richieste/);
});
