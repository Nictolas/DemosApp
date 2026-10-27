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
  assert.match(calls[0].sql,/RETURNING id, request_type, status, created_at/);
  assert.deepEqual(calls[0].args.slice(0,2),['synthetic-user','erasure']);
  assert.deepEqual(JSON.parse(calls[0].args[2]),
    {source:'gdpr_requests_api',details:'synthetic private message'});
});

test('GDPR GET reads only the authenticated user history and excludes request details', async () => {
  const calls = [];
  const pool = {async query(sql,args) {
    calls.push({sql,args});
    if (sql.includes('row_security_active(')) {
      return {rows:[{complete_visibility:true}]};
    }
    return {rows:[{
      id:'synthetic-id',request_type:'access',status:'pending',
      created_at:'2026-10-28T00:00:00Z',processed_at:null,
      request_data:{details:'must-never-be-returned'}
    }]};
  }};
  await withMockedRoute(pool, async ({get}) => {
    const res=response();
    await get({user:{id:'synthetic-user'}},res);
    assert.equal(res.statusCode,200);
    assert.equal(res.body.success,true);
    assert.deepEqual(res.body.data,[{
      id:'synthetic-id',tipo:'access',stato:'pending',
      data_richiesta:'2026-10-28T00:00:00Z',data_elaborazione:null
    }]);
    assert.equal(JSON.stringify(res.body).includes('must-never-be-returned'),false);
  });
  assert.equal(calls.length,2);
  assert.ok(calls[0].sql.includes('row_security_active('));
  assert.deepEqual(calls[1].args,['synthetic-user']);
  assert.match(calls[1].sql,/WHERE user_id = \$1/);
  assert.ok(!calls[1].sql.includes('request_data'));
});

test('GDPR GET refuses incomplete RLS-scoped history even when a policy exists', async () => {
  let rlsActive = true;
  let queryCount = 0;
  const pool = { async query(sql) {
    queryCount++;
    if (sql.includes('row_security_active(')) {
      return {rows:[{complete_visibility:!rlsActive}]};
    }
    if (sql.includes('FROM public.user_rights_requests')) return {rows:[]};
    throw Error('unexpected query');
  }};
  const origLog = console.error;
  console.error = () => {};
  try {
    await withMockedRoute(pool, async ({get}) => {
      const hidden = response();
      await get({userId:'synthetic-user'},hidden);
      assert.equal(hidden.statusCode,503);
      assert.equal(hidden.body.success,false);
      assert.ok(!JSON.stringify(hidden.body).includes('"data":[]'));
      assert.equal(queryCount,1,'do not query incomplete RLS-scoped history');
      rlsActive = false;
      const legitimatelyEmpty = response();
      await get({userId:'synthetic-user'},legitimatelyEmpty);
      assert.equal(legitimatelyEmpty.statusCode,200);
      assert.deepEqual(legitimatelyEmpty.body.data,[]);
    });
    assert.equal(queryCount,3);
  } finally {console.error=origLog;}
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
