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
    assert.equal(final,1,'restricted role must not create a false right request');

    console.log('GDPR_LEGACY_RIGHTS_REAL_PG17_PASS ' + JSON.stringify({
      onlySyntheticData:true,persistedReceiptUsesDatabaseId:true,
      userHistoryScoped:true,requestDetailsNotReflected:true,
      RlsDeniedWriteNoFakeAck:true,RlsHiddenHistoryNoFalseEmpty:true,
      noProviderAccess:true,productionUntouched:true
    }));
  }finally{
    if(restricted)await restricted.end();
    await admin.end();
  }
});
