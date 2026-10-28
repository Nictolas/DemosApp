'use strict';
// Disposable PostgreSQL 17 integration ONLY: no Supabase, Render, B2 or HTTP listener.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');

const DATABASE_URL =
  'postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_legacy_rights_ci';
const OTHER = 'synthetic-other-account';
const USER = 'synthetic-gdpr-requester';
const DENIED_ROLE = 'gdpr_rights_ci_restricted';

function guard() {
  const e = process.env;
  if (e.GITHUB_ACTIONS !== 'true' ||
      e.GDPR_LEGACY_PG_CI !== 'isolated' ||
      e.TEST_DATABASE_URL !== DATABASE_URL ||
      e.DATABASE_URL || e.SUPABASE_URL || e.SUPABASE_DB_URL ||
      e.SUPABASE_SERVICE_ROLE_KEY || e.RENDER || e.RENDER_SERVICE_ID) {
    throw Error('GDPR_LEGACY_RIGHTS_PG17_REFUSES_NONLOCAL_DATABASE');
  }
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) {this.statusCode=code;return this;},
    json(body) {this.body=body;return this;}
  };
}

async function withPoolRoute(pool, callback) {
  const paths = [
    require.resolve('../config/db'),
    require.resolve('../middleware/auth'),
    require.resolve('../routes/user/gdpr-requests')
  ];
  const previous=paths.map(p=>require.cache[p]);
  try {
    require.cache[paths[0]]={
      id:paths[0],filename:paths[0],loaded:true,exports:{pool}
    };
    require.cache[paths[1]]={
      id:paths[1],filename:paths[1],loaded:true,
      exports:{verifyToken(req,res,next){next();}}
    };
    delete require.cache[paths[2]];
    const router=require('../routes/user/gdpr-requests');
    const post=router.stack.find(l=>l.route?.methods.post)?.route.stack.at(-1)?.handle;
    const get=router.stack.find(l=>l.route?.methods.get)?.route.stack.at(-1)?.handle;
    assert.equal(typeof post,'function');
    assert.equal(typeof get,'function');
    await callback({post,get});
  } finally {
    for(let i=0;i<paths.length;i++){
      delete require.cache[paths[i]];
      if(previous[i]) require.cache[paths[i]]=previous[i];
    }
  }
}

async function withRightsHistoryRoute(pool, callback) {
  const paths=[
    require.resolve('../middleware/auth'),
    require.resolve('../middleware/validation'),
    require.resolve('../services/auditService'),
    require.resolve('../utils/emailCrypto'),
    require.resolve('../routes/user/gdpr-rights')
  ];
  const old=paths.map(path=>require.cache[path]);
  try {
    const mocked=[
      {verifyToken(req,res,next){next();},pool},
      {validateInput(){return (req,res,next)=>next();}},
      {logAction:async()=>{},getUserAuditLogs:async()=>[]},
      {decrypt(value){return value;}}
    ];
    for(let i=0;i<4;i++)require.cache[paths[i]]={
      id:paths[i],filename:paths[i],loaded:true,exports:mocked[i]
    };
    delete require.cache[paths[4]];
    const router=require('../routes/user/gdpr-rights');
    const handler=router.stack.find(layer=>
      layer.route?.path==='/rights-requests' && layer.route?.methods.get
    )?.route.stack.at(-1)?.handle;
    assert.equal(typeof handler,'function');
    const put=router.stack.find(layer=>
      layer.route?.path==='/limit-processing' && layer.route?.methods.put
    )?.route.stack.at(-1)?.handle;
    assert.equal(typeof put,'function');
    await callback(handler,put);
  } finally {
    for(let i=0;i<paths.length;i++){
      delete require.cache[paths[i]];
      if(old[i])require.cache[paths[i]]=old[i];
    }
  }
}

test('real PG17 rights request persists, history respects user scope, and RLS failures are honest', async () => {
  guard();
  const admin = new Pool({connectionString:DATABASE_URL, ssl:false,max:2});
  let restricted;
  try {
    const identity=(await admin.query(
      "SELECT current_database() AS db, current_setting('server_version_num')::int AS version"
    )).rows[0];
    assert.equal(identity.db,'gdpr_legacy_rights_ci');
    assert.equal(Math.floor(identity.version/10000),17);

    // Mirror ONLY the existing production table's relevant columns/types.
    // PostgreSQL 17 ephemeral container is destroyed after the CI run.
    await admin.query(
      'CREATE TABLE public.user_rights_requests (' +
      'id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ' +
      'user_id varchar(255) NOT NULL, ' +
      'request_type varchar(50) NOT NULL, ' +
      "status varchar(20) DEFAULT 'pending', " +
      "request_data jsonb DEFAULT '{}'::jsonb, " +
      'created_at timestamptz DEFAULT CURRENT_TIMESTAMP, ' +
      'processed_at timestamptz)'
    );
    // Synthetic mirror of the existing processing-limit columns. The
    // fixture exists only in this disposable PostgreSQL 17 CI container.
    await admin.query(
      'CREATE TABLE public.data_processing_limits (' +
      'id uuid PRIMARY KEY DEFAULT gen_random_uuid(), ' +
      'user_id varchar(255) NOT NULL UNIQUE, ' +
      'processing_limited boolean NOT NULL, ' +
      'limited_categories text[] NOT NULL, reason text, ' +
      'updated_at timestamptz DEFAULT CURRENT_TIMESTAMP)'
    );
    await admin.query('ALTER TABLE public.user_rights_requests ENABLE ROW LEVEL SECURITY');
    await admin.query('REVOKE ALL ON public.user_rights_requests FROM PUBLIC');

    let persistedId;
    await withPoolRoute(admin, async ({post,get}) => {
      const ack=response();
      await post({userId:USER,body:{tipo:'access',dettagli:'synthetic GDPR access question'}},ack);
      assert.equal(ack.statusCode,201);
      assert.equal(ack.body.success,true);
      persistedId=ack.body.data.id;
      assert.match(persistedId,/^[0-9a-f]{8}-[0-9a-f-]{27,}$/);
      const saved=(await admin.query(
        'SELECT user_id,request_type,request_data,status FROM public.user_rights_requests WHERE id=$1',
        [persistedId]
      )).rows[0];
      assert.equal(saved.user_id,USER);
      assert.equal(saved.request_type,'access');
      assert.equal(saved.status,'pending');
      assert.deepEqual(saved.request_data,{
        source:'gdpr_requests_api',details:'synthetic GDPR access question'
      });

      const history=response();
      await get({userId:USER},history);
      assert.equal(history.statusCode,200);
      assert.equal(history.body.data.length,1);
      assert.equal(history.body.data[0].id,persistedId);
      assert.ok(!JSON.stringify(history.body).includes('synthetic GDPR access question'));

      const otherHistory=response();
      await get({userId:OTHER},otherHistory);
      assert.equal(otherHistory.statusCode,200);
      assert.deepEqual(otherHistory.body.data,[]);
    });

    // Actual concurrent writes with the same client UUID must collapse
    // into exactly one row. No frontend/client secret is used.
    const concurrentKey='ee500c1a-b5a7-4c0a-9de2-d0e60e5a1a31';
    await withPoolRoute(admin,async ({post})=>{
      const body={tipo:'access',dettagli:'same-synthetic-concurrent-request'};
      const attempts=await Promise.all(Array.from({length:3},async()=>{
        const res=response();
        await post({userId:USER,headers:{'idempotency-key':concurrentKey},body},res);
        return res;
      }));
      assert.deepEqual(attempts.map(r=>r.statusCode).sort(),[200,200,201]);
      assert.ok(attempts.every(r=>r.body.data.id===concurrentKey));
      assert.equal((await admin.query(
        'SELECT COUNT(*)::int AS n FROM public.user_rights_requests WHERE id=$1',
        [concurrentKey]
      )).rows[0].n,1);
      for(const mutated of [
        {userId:OTHER,body},
        {userId:USER,body:{tipo:'access',dettagli:'different-request'}}
      ]){
        const result=response();
        await post({...mutated,headers:{'idempotency-key':concurrentKey}},result);
        assert.equal(result.statusCode,409);
        assert.equal(result.body.success,false);
      }
      assert.equal((await admin.query(
        'SELECT COUNT(*)::int AS n FROM public.user_rights_requests WHERE id=$1',
        [concurrentKey]
      )).rows[0].n,1);

      // Simulate the server COMMIT succeeding but the HTTP receipt getting
      // lost. On retry, the same ID must return the real existing row.
      const uncertainKey='e018f48a-8a11-46c7-8f94-553ba1fae032';
      await admin.query(
        "INSERT INTO public.user_rights_requests " +
        "(id,user_id,request_type,request_data,status) " +
        "VALUES ($1,$2,$3,$4::jsonb,'pending')",
        [uncertainKey,USER,'erasure',
         JSON.stringify({source:'gdpr_requests_api',details:'synthetic-after-commit'})]
      );
      const retry=response();
      await post({
        userId:USER,headers:{'idempotency-key':uncertainKey},
        body:{tipo:'erasure',dettagli:'synthetic-after-commit'}
      },retry);
      assert.equal(retry.statusCode,200);
      assert.equal(retry.body.data.id,uncertainKey);
      assert.equal((await admin.query(
        'SELECT COUNT(*)::int AS n FROM public.user_rights_requests WHERE id=$1',
        [uncertainKey]
      )).rows[0].n,1);
    });

    await admin.query(
      "CREATE ROLE " + DENIED_ROLE +
      " LOGIN PASSWORD 'synthetic-ci-only' NOBYPASSRLS NOSUPERUSER"
    );
    await admin.query('GRANT USAGE ON SCHEMA public TO ' + DENIED_ROLE);
    await admin.query(
      'GRANT SELECT,INSERT ON public.user_rights_requests TO ' + DENIED_ROLE
    );
    // A policy may be present but permit only some other user's records.
    // A catalog policy-count check alone would wrongly certify completeness.
    await admin.query(
      'CREATE POLICY gdpr_ci_partial_history ' +
      'ON public.user_rights_requests FOR SELECT TO ' + DENIED_ROLE +
      " USING (user_id='" + OTHER + "')"
    );
    restricted=new Pool({
      host:'127.0.0.1',port:5432,database:'gdpr_legacy_rights_ci',
      user:DENIED_ROLE,password:'synthetic-ci-only',ssl:false,max:1
    });
    const role=(await restricted.query(
      "SELECT current_user AS role, " +
      "(SELECT rolbypassrls FROM pg_catalog.pg_roles WHERE rolname=current_user) AS bypass"
    )).rows[0];
    assert.deepEqual(role,{role:DENIED_ROLE,bypass:false});

    const priorLog=console.error;
    console.error=()=>{};
    try {
      await withPoolRoute(restricted,async ({post,get}) => {
        const deniedWrite=response();
        await post({userId:USER,body:{tipo:'erasure',dettagli:'synthetic request'}},deniedWrite);
        assert.equal(deniedWrite.statusCode,503);
        assert.equal(deniedWrite.body.success,false);
        const deniedRead=response();
        await get({userId:USER},deniedRead);
        assert.equal(deniedRead.statusCode,503,
          'absence caused by RLS must never be reported as true empty history');
        assert.equal(deniedRead.body.success,false);
      });
    } finally {console.error=priorLog;}
    const final=(await admin.query(
      'SELECT COUNT(*)::int AS n FROM public.user_rights_requests'
    )).rows[0].n;
    assert.equal(final,3,'only the first request and two distinct idempotent keys exist');

    // Real SQL regression for the user-visible GDPR history. Insert 54
    // synthetic requests after the idempotency count assertions: 57 total
    // for USER. Verify bounded pages, no DPO payload and an RLS fail-closed.
    await admin.query(
      "INSERT INTO public.user_rights_requests " +
      "(user_id,request_type,request_data,status) " +
      "SELECT $1,'access'," +
      "jsonb_build_object('secret','synthetic-never-return')," +
      "'pending' FROM generate_series(1,54)",
      [USER]
    );
    await withRightsHistoryRoute(admin,async get=>{
      const first=response();
      await get({userId:USER,query:{limit:'50',offset:'0'}},first);
      assert.equal(first.statusCode,200);
      assert.equal(first.body.data.length,50);
      assert.equal(first.body.pagination.has_more,true);
      assert.equal(first.body.pagination.next_offset,50);
      assert.doesNotMatch(JSON.stringify(first.body),/synthetic-never-return/);
      const next=response();
      await get({userId:USER,query:{limit:'50',offset:'50'}},next);
      assert.equal(next.statusCode,200);
      assert.equal(next.body.data.length,7);
      assert.equal(next.body.pagination.has_more,false);
      assert.equal(next.body.pagination.next_offset,null);
      const firstSet=new Set(first.body.data.map(row=>row.id));
      assert.ok(next.body.data.every(row=>!firstSet.has(row.id)),
        'stable tie-break ID must prevent duplicate rows');
      const other=response();
      await get({userId:OTHER,query:{}},other);
      assert.equal(other.statusCode,200);
      assert.deepEqual(other.body.data,[]);
    });
    const oldLog=console.error;
    console.error=()=>{};
    try {
      await withRightsHistoryRoute(restricted,async get=>{
        const denied=response();
        await get({userId:USER,query:{}},denied);
        assert.equal(denied.statusCode,503,
          'real RLS-restricted role must never report empty/full history');
        assert.equal(denied.body.success,false);
      });
    }finally{console.error=oldLog;}

    // Regression: the old handler committed processing_limited via a
    // standalone pool.query and only then tried to persist the GDPR receipt.
    // A failed INSERT could leave a real restriction changed despite HTTP 500.
    const pgDollarQuote = String.fromCharCode(36, 36);
    await admin.query(
      "CREATE FUNCTION public.gdpr_ci_reject_processing_receipt() " +
      "RETURNS trigger LANGUAGE plpgsql AS " + pgDollarQuote + " BEGIN " +
      "IF NEW.request_type='limit_processing' AND " +
      "NEW.request_data->>'reason'='synthetic-force-fail' THEN " +
      "RAISE EXCEPTION 'synthetic receipt failure'; END IF; " +
      "RETURN NEW; END " + pgDollarQuote
    );
    await admin.query(
      'CREATE TRIGGER gdpr_ci_reject_processing_receipt ' +
      'BEFORE INSERT ON public.user_rights_requests ' +
      'FOR EACH ROW EXECUTE FUNCTION public.gdpr_ci_reject_processing_receipt()'
    );
    await withRightsHistoryRoute(admin, async (_get, put) => {
      const request = (limited,reason,categories=['personal_data'],headers={})=>({
        userId:USER, body:{limited,categories,reason}, headers,
        ip:'127.0.0.1', connection:{remoteAddress:'127.0.0.1'},
        get:()=> 'synthetic-pg17-ci'
      });
      const accepted=response();
      await put(request(true,'synthetic-approved'),accepted);
      assert.equal(accepted.statusCode,200);
      assert.equal(accepted.body.success,true);
      assert.ok(accepted.body.request_id);
      assert.equal((await admin.query(
        'SELECT processing_limited FROM public.data_processing_limits WHERE user_id=$1',
        [USER]
      )).rows[0].processing_limited,true);
      const receiptCount=async()=>(await admin.query(
        "SELECT COUNT(*)::int AS n FROM public.user_rights_requests " +
        "WHERE user_id=$1 AND request_type='limit_processing'",[USER]
      )).rows[0].n;
      assert.equal(await receiptCount(),1);

      const oldLog=console.error;console.error=()=>{};
      try {
        const denied=response();
        await put(request(false,'synthetic-force-fail'),denied);
        assert.equal(denied.statusCode,503);
        assert.equal(denied.body.success,false);
      } finally {console.error=oldLog;}
      assert.equal((await admin.query(
        'SELECT processing_limited FROM public.data_processing_limits WHERE user_id=$1',
        [USER]
      )).rows[0].processing_limited,true,
      'a failed rights receipt MUST roll back the preceding processing-limit update');
      assert.equal(await receiptCount(),1,
      'no unconfirmed or duplicated rights receipt may survive rollback');

      const cleared=response();
      await put(request(false,'synthetic-clear-all',[]),cleared);
      assert.equal(cleared.statusCode,200,
        'an empty list must be accepted when removing all restrictions');
      assert.equal(cleared.body.success,true);
      const clearedState=(await admin.query(
        'SELECT processing_limited, limited_categories FROM public.data_processing_limits WHERE user_id=$1',
        [USER]
      )).rows[0];
      assert.deepEqual(clearedState,{processing_limited:false,limited_categories:[]});
      assert.equal(await receiptCount(),2,
        'successful removal must persist its own real receipt');

      // A lost HTTP receipt can be safely retried with the SAME UUID.
      // A later opposite choice must not be reverted by an old retry.
      const idempotentKey='c691fcd2-80fa-4cea-8f5e-642f4441149a';
      const firstKeyed=response();
      await put(request(true,'synthetic-retry-choice',
        ['political_opinions'],{'idempotency-key':idempotentKey}),firstKeyed);
      assert.equal(firstKeyed.statusCode,200);
      assert.equal(firstKeyed.body.request_id,idempotentKey);
      assert.equal(await receiptCount(),3);
      const newerChoice=response();
      await put(request(false,'synthetic-newer-choice',[]),newerChoice);
      assert.equal(newerChoice.statusCode,200);
      assert.equal(await receiptCount(),4);

      const oldRetry=response();
      await put(request(true,'synthetic-retry-choice',
        ['political_opinions'],{'idempotency-key':idempotentKey}),oldRetry);
      assert.equal(oldRetry.statusCode,200);
      assert.equal(oldRetry.body.replayed,true);
      assert.equal(oldRetry.body.request_id,idempotentKey);
      assert.equal(oldRetry.body.data,null,
        'a replay must not misrepresent the rolled-back choice as current');
      assert.equal(await receiptCount(),4,'a retry must not add a new receipt');
      assert.equal((await admin.query(
        'SELECT processing_limited FROM public.data_processing_limits WHERE user_id=$1',
        [USER]
      )).rows[0].processing_limited,false,
      'a retry of the older restriction must not undo the newer removal');

      for(const change of [
        {userId:OTHER,body:{limited:true,categories:['political_opinions'],
          reason:'synthetic-retry-choice'}},
        {userId:USER,body:{limited:true,categories:['political_opinions'],
          reason:'synthetic-changed-payload'}}
      ]) {
        const conflict=response();
        await put({...request(true,change.body.reason,change.body.categories,
          {'idempotency-key':idempotentKey}),userId:change.userId},conflict);
        assert.equal(conflict.statusCode,409,
          'a different owner or payload must not reuse the receipt');
      }
      assert.equal(await receiptCount(),4);

      // Concurrent same-key calls serialize on the processing-limit row and
      // the receipt PK; precisely one update + receipt must survive.
      const parallelKey='ffdd4cba-7315-47dd-a35f-06b1e735ea01';
      const simultaneous=await Promise.all(Array.from({length:3},async()=>{
        const result=response();
        await put(request(true,'synthetic-parallel-choice',
          ['personal_data'],{'idempotency-key':parallelKey}),result);
        return result;
      }));
      assert.ok(simultaneous.every(result=>result.statusCode===200));
      assert.equal(simultaneous.filter(result=>result.body.replayed).length,2);
      assert.equal(await receiptCount(),5,
        'three concurrent retries must persist only one receipt');
      assert.equal((await admin.query(
        'SELECT processing_limited FROM public.data_processing_limits WHERE user_id=$1',
        [USER]
      )).rows[0].processing_limited,true);

      const invalidKey=response();
      await put(request(false,'synthetic-invalid-key',[],
        {'idempotency-key':'not-a-uuid'}),invalidKey);
      assert.equal(invalidKey.statusCode,400);
      assert.equal(await receiptCount(),5);

      for(const body of [
        {limited:true,categories:[]},
        {limited:'true',categories:['personal_data']},
        {limited:true,categories:{not:'an-array'}},
        {limited:true,categories:['personal_data','personal_data']}
      ]) {
        const invalid=response();
        await put({userId:USER,body},invalid);
        assert.equal(invalid.statusCode,400);
      }
      assert.equal(await receiptCount(),5,
        'new idempotent PUT scenarios intentionally add three distinct receipts');
    });

    console.log('GDPR_LEGACY_RIGHTS_REAL_PG17_PASS ' + JSON.stringify({
      onlySyntheticData:true,persistedReceiptUsesDatabaseId:true,
      userHistoryScoped:true,requestDetailsNotReflected:true,
      RlsDeniedWriteNoFakeAck:true,RlsHiddenHistoryNoFalseEmpty:true,
      concurrentRetryExactlyOnce:true, uncertainCommitRetryRecovered:true,
      noProviderAccess:true,productionUntouched:true
    }));
  }finally{
    if(restricted)await restricted.end();
    await admin.end();
  }
});
