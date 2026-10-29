'use strict';

// Synthetic PG17 CI-only proof of transaction-level fencing. Never import in app.
// No Backblaze, Render, Supabase, production SQL, users or credentials.
const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool, Client } = require('pg');
const {SyntheticIndependentAdmissionAuthority}=
  require('./fixtures/gdprIndependentAdmissionEpochSynthetic');

const URL = 'postgresql://postgres:synthetic-only@127.0.0.1:5432/gdpr_outbox_worker_ci';
const permitted = process.env.GITHUB_ACTIONS === 'true' &&
  process.env.GDPR_OUTBOX_WORKER_CI === 'isolated' &&
  process.env.TEST_DATABASE_URL === URL &&
  !process.env.DATABASE_URL &&
  !process.env.SUPABASE_DB_URL &&
  !process.env.GDPR_LEDGER_B2_ENABLED &&
  !process.env.GDPR_ERASURE_OUTBOX_WORKER_ENABLED;

if (!permitted) {
  test('distributed fence requires exact disposable PG17 CI target', {
    skip:'Set only explicit synthetic GitHub Actions PostgreSQL 17 fixture'
  }, () => {});
} else {
  const SCHEMA = 'gdpr_fence_ci';
  const ROLE = 'gdpr_fence_runtime_ci';
  const OWNER = 'gdpr_fence_owner_ci';
  const ownerPool = new Pool({connectionString:URL,ssl:false,max:4});
  let writerPool;
  let installed = false;

  async function setup() {
    const v = (await ownerPool.query(
      'SELECT current_database() AS db, current_setting($1)::integer AS version',
      ['server_version_num']
    )).rows[0];
    assert.equal(v.db, 'gdpr_outbox_worker_ci');
    assert.equal(Math.floor(v.version / 10000),17);
    await ownerPool.query('CREATE ROLE '+OWNER+' NOLOGIN NOBYPASSRLS NOSUPERUSER');
    await ownerPool.query('CREATE ROLE '+ROLE+
      " LOGIN PASSWORD 'synthetic-role-no-remote-credentials' NOBYPASSRLS NOSUPERUSER");
    await ownerPool.query('CREATE SCHEMA '+SCHEMA);
    await ownerPool.query('ALTER SCHEMA '+SCHEMA+' OWNER TO '+OWNER);
    await ownerPool.query('REVOKE ALL ON SCHEMA '+SCHEMA+' FROM PUBLIC');
    await ownerPool.query('GRANT USAGE ON SCHEMA '+SCHEMA+' TO '+ROLE);
    await ownerPool.query('CREATE TABLE '+SCHEMA+
      '.gate (singleton boolean PRIMARY KEY DEFAULT true, open boolean NOT NULL,'+
      ' epoch bigint NOT NULL CHECK (epoch > 0),'+
      ' database_id text NOT NULL CHECK(length(database_id)>0), CHECK(singleton=true))');
    await ownerPool.query('INSERT INTO '+SCHEMA+'.gate (singleton,open,epoch,database_id) VALUES (true,true,1,\'original-primary\')');
    await ownerPool.query('CREATE TABLE '+SCHEMA+
      '.accounts (id text PRIMARY KEY, consent boolean NOT NULL,'+
      ' deleted boolean NOT NULL DEFAULT false, revision bigint NOT NULL DEFAULT 0)');
    await ownerPool.query('INSERT INTO '+SCHEMA+
      ".accounts(id,consent) VALUES ('alice',true),('bob',true)");
    await ownerPool.query('CREATE TABLE '+SCHEMA+
      '.written (id text PRIMARY KEY, subject text NOT NULL, kind text NOT NULL,'+
      ' expected_revision bigint NOT NULL, resulting_revision bigint NOT NULL)');
    // ALL writes must go through a locked trusted gateway, never direct table DML.
    // The superuser owning this CI fixture is NOT evidence of a safe production owner.
    await ownerPool.query('CREATE FUNCTION '+SCHEMA+
      '.perform_synthetic_write(p_id text,p_subject text,p_kind text,'+
      'p_epoch bigint,p_expected_revision bigint) RETURNS text '+
      'LANGUAGE plpgsql SECURITY DEFINER SET search_path=pg_catalog,pg_temp AS $fn$'+
      '\nDECLARE v_gate_open boolean; v_epoch bigint; v_revision bigint;'+
      ' v_deleted boolean; v_prior record; v_next bigint;'+
      '\nBEGIN'+
      '\n IF p_id IS NULL OR p_id !~ $re$^[a-zA-Z0-9_-]{1,80}$$re$ OR'+
      ' p_subject IS NULL OR p_subject !~ $re$^[a-zA-Z0-9_-]{1,80}$$re$ OR'+
      " p_kind IS NULL OR p_kind NOT IN ('REVOKE','GRANT','DELETE') OR"+
      ' p_epoch IS NULL OR p_expected_revision IS NULL THEN'+
      " RAISE EXCEPTION 'GDPR_FENCE_INVALID_INPUT'; END IF;"+
      '\n -- Shared global gate stays locked until transaction COMMIT/ROLLBACK.'+
      '\n PERFORM pg_catalog.pg_advisory_xact_lock_shared(714296, 1);'+
      ' \n-- Subject lock serializes requests for ONE user across processes/DB sessions.'+
      ' \n-- Hash collisions only serialize extra subjects; they do not weaken safety.'+
      ' \nPERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_subject,714296));'+
      '\n SELECT open,epoch INTO v_gate_open,v_epoch FROM '+SCHEMA+
      '.gate WHERE singleton=true FOR SHARE;'+
      " \nIF NOT FOUND OR v_gate_open IS DISTINCT FROM true OR v_epoch != p_epoch THEN"+
      " RAISE EXCEPTION 'GDPR_FENCE_CLOSED_OR_STALE_EPOCH'; END IF;"+
      '\n SELECT * INTO v_prior FROM '+SCHEMA+'.written WHERE id=p_id;'+
      '\n IF FOUND THEN'+
      ' \n IF v_prior.subject != p_subject OR v_prior.kind != p_kind OR'+
      ' v_prior.expected_revision != p_expected_revision THEN'+
      " RAISE EXCEPTION 'GDPR_FENCE_IDEMPOTENCY_CONFLICT'; END IF;"+
      " \n RETURN 'already-applied'; END IF;"+
      '\n SELECT revision,deleted INTO v_revision,v_deleted FROM '+SCHEMA+
      '.accounts WHERE id=p_subject FOR UPDATE;'+
      " \nIF NOT FOUND THEN RAISE EXCEPTION 'GDPR_FENCE_UNKNOWN_SUBJECT'; END IF;"+
      " \nIF v_revision != p_expected_revision THEN RAISE EXCEPTION 'GDPR_FENCE_STALE_REVISION'; END IF;"+
      " \nIF v_deleted THEN RAISE EXCEPTION 'GDPR_FENCE_ACCOUNT_DELETED'; END IF;"+
      '\n UPDATE '+SCHEMA+'.accounts'+
      " SET revision=revision+1, consent=CASE WHEN p_kind='GRANT' THEN true ELSE false END,"+
      " deleted=CASE WHEN p_kind='DELETE' THEN true ELSE deleted END"+
      ' WHERE id=p_subject RETURNING revision INTO v_next;'+
      '\n INSERT INTO '+SCHEMA+
      '.written (id,subject,kind,expected_revision,resulting_revision)'+
      ' VALUES(p_id,p_subject,p_kind,p_expected_revision,v_next);'+
      " \nRETURN 'applied'; END; $fn$");
    // The SECURITY DEFINER must not run as the postgres superuser.
    // Isolated NONLOGIN/NOBYPASSRLS/NOSUPERUSER owner receives only the
    // relevant fixture objects. Operator and runtime stay distinct.
    for (const table of ['gate','accounts','written']) {
      await ownerPool.query('ALTER TABLE '+SCHEMA+'.'+table+' OWNER TO '+OWNER);
    }
    await ownerPool.query('ALTER FUNCTION '+SCHEMA+
      '.perform_synthetic_write(text,text,text,bigint,bigint) OWNER TO '+OWNER);
    await ownerPool.query('REVOKE ALL ON ALL TABLES IN SCHEMA '+SCHEMA+' FROM PUBLIC');
    await ownerPool.query('REVOKE EXECUTE ON FUNCTION '+SCHEMA+
      '.perform_synthetic_write(text,text,text,bigint,bigint) FROM PUBLIC');
    await ownerPool.query('GRANT EXECUTE ON FUNCTION '+SCHEMA+
      '.perform_synthetic_write(text,text,text,bigint,bigint) TO '+ROLE);
    writerPool = new Pool({
      host:'127.0.0.1',port:5432,database:'gdpr_outbox_worker_ci',
      user:ROLE,password:'synthetic-role-no-remote-credentials',
      ssl:false,max:4
    });
    installed=true;
  }
  const sql = 'SELECT '+SCHEMA+'.perform_synthetic_write($1,$2,$3,$4,$5) AS outcome';
  const submit = (client,id,subject,kind,epoch,revision) =>
    client.query(sql,[id,subject,kind,epoch,revision]);
  const outcome = r=>r.rows[0]?.outcome;
  async function freezeGate({client=ownerPool,epoch=2}={}) {
    // For the test operator ONLY. The CI runtime role never receives this DML.
    await client.query('SELECT pg_advisory_xact_lock(714296,1)');
    await client.query('UPDATE '+SCHEMA+'.gate SET open=false,epoch=$1 WHERE singleton=true',[epoch]);
  }

  test('fixture boots with least-privilege writer and real PG17 xact locks',async()=>{
    await setup();
    const info=(await writerPool.query(
      'SELECT current_user AS role, (SELECT rolbypassrls FROM pg_roles WHERE rolname=current_user) AS bypass'
    )).rows[0];
    assert.deepEqual(info,{role:ROLE,bypass:false});
    const ownerInfo=(await ownerPool.query(
      'SELECT rolcanlogin,rolbypassrls,rolsuper FROM pg_roles WHERE rolname=$1',
      [OWNER]
    )).rows[0];
    assert.deepEqual(ownerInfo,{rolcanlogin:false,rolbypassrls:false,rolsuper:false});
    for(const table of ['gate','accounts','written']) {
      const grants=(await writerPool.query(
        'SELECT has_table_privilege(current_user,$1,$2) AS allowed',
        [SCHEMA+'.'+table,'INSERT']
      )).rows[0];
      assert.equal(grants.allowed,false,'direct INSERT blocked: '+table);
    }
    await assert.rejects(writerPool.query('UPDATE '+SCHEMA+
      ".accounts SET consent=false WHERE id='alice'"),/permission denied/);
  });

  test('different subjects can COMMIT while an Alice transaction stays open',async()=>{
    const alice=await writerPool.connect();
    try{
      await alice.query('BEGIN');
      assert.equal(outcome(await submit(alice,'alice-revoke-1','alice','REVOKE',1,0)),'applied');
      // This would block if the gateway used one exclusive global lock.
      const result=await writerPool.query(
        "SELECT "+SCHEMA+".perform_synthetic_write($1,$2,$3,$4,$5) AS outcome",
        ['bob-revoke-1','bob','REVOKE',1,0]
      );
      assert.equal(outcome(result),'applied');
      await alice.query('COMMIT');
    }finally{try{await alice.query('ROLLBACK')}catch{}alice.release();}
    const result=(await ownerPool.query('SELECT id,consent,revision FROM '+SCHEMA+
      '.accounts ORDER BY id')).rows;
    assert.deepEqual(result,[
      {id:'alice',consent:false,revision:'1'},
      {id:'bob',consent:false,revision:'1'}
    ]);
  });

  test('same-subject concurrent transaction blocks then rejects stale revision',async()=>{
    const first=await writerPool.connect();
    const second=await writerPool.connect();
    try{
      await first.query('BEGIN');
      assert.equal(outcome(await submit(first,'alice-grant-1','alice','GRANT',1,1)),'applied');
      await second.query('BEGIN');
      await second.query("SET LOCAL lock_timeout = '200ms'");
      await assert.rejects(submit(second,'alice-revoke-2','alice','REVOKE',1,1),
        /lock timeout/);
      await second.query('ROLLBACK');
      await first.query('COMMIT');
      await assert.rejects(submit(second,'alice-revoke-2','alice','REVOKE',1,1),
        /GDPR_FENCE_STALE_REVISION/);
      assert.equal(outcome(await submit(second,'alice-revoke-2','alice','REVOKE',1,2)),'applied');
      assert.equal(outcome(await submit(second,'alice-revoke-2','alice','REVOKE',1,2)),
        'already-applied');
      await assert.rejects(submit(second,'alice-revoke-2','bob','REVOKE',1,2),
        /GDPR_FENCE_IDEMPOTENCY_CONFLICT/);
    }finally{try{await first.query('ROLLBACK')}catch{}try{await second.query('ROLLBACK')}catch{}first.release();second.release();}
  });

  test('maintenance freeze waits for active writer, then denies stale and new writes',async()=>{
    const active=await writerPool.connect();
    const operator=await ownerPool.connect();
    try{
      await active.query('BEGIN');
      assert.equal(outcome(await submit(active,'bob-grant-1','bob','GRANT',1,1)),'applied');
      await operator.query('BEGIN');
      await operator.query("SET LOCAL lock_timeout = '200ms'");
      await assert.rejects(freezeGate({client:operator}),/lock timeout/);
      await operator.query('ROLLBACK');
      await active.query('COMMIT');
      await operator.query('BEGIN');
      await freezeGate({client:operator});
      await operator.query('COMMIT');
      await assert.rejects(submit(writerPool,'alice-grant-old-epoch','alice','GRANT',1,3),
        /GDPR_FENCE_CLOSED_OR_STALE_EPOCH/);
      await assert.rejects(submit(writerPool,'alice-grant-new-epoch','alice','GRANT',2,3),
        /GDPR_FENCE_CLOSED_OR_STALE_EPOCH/);
      const row=(await ownerPool.query('SELECT open,epoch FROM '+SCHEMA+'.gate')).rows[0];
      assert.deepEqual(row,{open:false,epoch:'2'});
    }finally{try{await active.query('ROLLBACK')}catch{}try{await operator.query('ROLLBACK')}catch{}active.release();operator.release();}
  });

  test('runtime role cannot reopen maintenance or bypass the gateway with DML',async()=>{
    await assert.rejects(writerPool.query('UPDATE '+SCHEMA+
      '.gate SET open=true,epoch=1'),/permission denied/);
    await assert.rejects(writerPool.query('INSERT INTO '+SCHEMA+
      ".written(id,subject,kind,expected_revision,resulting_revision) VALUES('fake','alice','DELETE',3,4)"),
      /permission denied/);
    const count=(await ownerPool.query('SELECT count(*)::int AS n FROM '+SCHEMA+
      '.written')).rows[0].n;
    assert.equal(count,5,'only verified writes reached the fixture journal');
  });

  test('old PostgreSQL backup can reopen SQL gate but external epoch still refuses admission',async()=>{
    const authority=new SyntheticIndependentAdmissionAuthority();
    const original=authority.bootstrap({
      databaseId:'original-primary',checkpointHead:'a'.repeat(64)
    });
    // Simulate recovery from an old, locally "open" gate *after* authority
    // has been independently suspended. The DB itself has no memory of freeze.
    const suspended=authority.suspend(original);
    await ownerPool.query('UPDATE '+SCHEMA+
      ".gate SET open=true,epoch=1,database_id='original-primary'");
    const local=(await ownerPool.query('SELECT open,epoch,database_id FROM '+
      SCHEMA+'.gate')).rows[0];
    assert.deepEqual(local,{open:true,epoch:'1',database_id:'original-primary'});
    for (const operation of ['read','write']) {
      assert.throws(()=>authority.assertAdmission({
        receipt:original,localDatabaseId:local.database_id,
        localEpoch:Number(local.epoch),localOpen:local.open,operation
      }),{code:'GDPR_EPOCH_STALE_OR_FORGED'});
      assert.throws(()=>authority.assertAdmission({
        receipt:suspended,localDatabaseId:local.database_id,
        localEpoch:Number(local.epoch),localOpen:local.open,operation
      }),{code:'GDPR_EPOCH_ADMISSION_BLOCKED'});
    }
    // This is the decisive *negative proof*: raw DB gateway credentials
    // can STILL write in the restored old snapshot if they bypass the
    // synthetic external admission path. Do NOT claim operational safety.
    const attacker=await writerPool.connect();
    try {
      await attacker.query('BEGIN');
      const raw=await submit(attacker,'unsafe-raw-after-restore',
        'alice','GRANT',1,3);
      assert.equal(outcome(raw),'applied');
      await attacker.query('ROLLBACK');
    } finally {
      try{await attacker.query('ROLLBACK')}catch{}
      attacker.release();
    }
    const count=(await ownerPool.query('SELECT count(*)::int AS n FROM '+
      SCHEMA+'.written')).rows[0].n;
    assert.equal(count,5,'negative control never persists its synthetic bypass');
  });

  test('admitted recovered generation needs new SQL identity and fresh independent ticket',async()=>{
    const authority=new SyntheticIndependentAdmissionAuthority();
    const old=authority.bootstrap({
      databaseId:'original-primary',checkpointHead:'a'.repeat(64)
    });
    const blocked=authority.suspend(old);
    const resumed=authority.admitRestoredGeneration({
      receipt:blocked,newDatabaseId:'restored-primary',
      newCheckpointHead:'b'.repeat(64),
      // All of these are test booleans, NOT external provider proof.
      writersFenced:true,ingressBlocked:true,providersQuarantined:true,
      journalComplete:true,replayVerified:true
    });
    const stale=(await ownerPool.query('SELECT open,epoch,database_id FROM '+
      SCHEMA+'.gate')).rows[0];
    assert.throws(()=>authority.assertAdmission({
      receipt:resumed,localDatabaseId:stale.database_id,
      localEpoch:Number(stale.epoch),localOpen:stale.open,operation:'read'
    }),{code:'GDPR_EPOCH_ADMISSION_BLOCKED'});
    // Synthetic operator creates a NEW database generation configuration.
    await ownerPool.query('UPDATE '+SCHEMA+
      ".gate SET open=true,epoch=3,database_id='restored-primary'");
    const fresh=(await ownerPool.query('SELECT open,epoch,database_id FROM '+
      SCHEMA+'.gate')).rows[0];
    assert.deepEqual(authority.assertAdmission({
      receipt:resumed,localDatabaseId:fresh.database_id,
      localEpoch:Number(fresh.epoch),localOpen:fresh.open,operation:'read'
    }),{syntheticAdmission:true,productionRecoveryReady:false,epoch:3});
    assert.throws(()=>authority.assertAdmission({
      receipt:old,localDatabaseId:fresh.database_id,
      localEpoch:Number(fresh.epoch),localOpen:fresh.open,operation:'read'
    }),{code:'GDPR_EPOCH_STALE_OR_FORGED'});
    // No production admission is ever returned by this fixture.
  });

  test('operator denies new logins, drains active SQL sessions and rolls back uncommitted privacy write',async()=>{
    // THIS IS A DISPOSABLE PG17 REHEARSAL, not real external network isolation.
    // It intentionally proves NOLOGIN alone does NOT terminate old sessions.
    const session=await writerPool.connect();
    session.on('error',()=>{}); // Expected when the operator terminates backend.
    let released=false;
    try {
      const who=(await session.query(
        'SELECT current_user AS role, pg_backend_pid() AS pid'
      )).rows[0];
      assert.equal(who.role,ROLE);

      await ownerPool.query('ALTER ROLE '+ROLE+' NOLOGIN PASSWORD NULL');
      const newClient=new Client({
        host:'127.0.0.1',port:5432,database:'gdpr_outbox_worker_ci',
        user:ROLE,password:'synthetic-role-no-remote-credentials',ssl:false,
        connectionTimeoutMillis:1500
      });
      try {
        await assert.rejects(newClient.connect(),
          /not permitted to log in|password authentication failed/i);
      } finally {
        await newClient.end().catch(()=>{});
      }

      // A connection established before NOLOGIN remains usable: proof that
      // credential revocation alone does not close the old SQL data plane.
      assert.equal((await session.query('SELECT 1 AS x')).rows[0].x,1);
      await session.query('BEGIN');
      assert.equal(outcome(await submit(session,'unsafe-before-drain',
        'alice','GRANT',3,3)),'applied');
      await session.query('ROLLBACK');

      // Simulate a privacy write mid-transaction and sever the live backend.
      await session.query('BEGIN');
      assert.equal(outcome(await submit(session,'uncommitted-before-kill',
        'alice','DELETE',3,3)),'applied');
      const terminated=await ownerPool.query(
        'SELECT pg_terminate_backend($1::integer) AS killed',[who.pid]
      );
      assert.equal(terminated.rows[0].killed,true);
      await assert.rejects(session.query('SELECT 1'),
        /terminating connection|connection terminated|Client has encountered a connection error|Connection terminated|not queryable/i);
      session.release(true);
      released=true;

      // Prevent any other pooled, pre-existing runtime sessions from surviving.
      await ownerPool.query('SELECT pg_terminate_backend(pid) FROM pg_stat_activity'+
        ' WHERE usename=$1 AND pid<>pg_backend_pid()',[ROLE]);
      const active=await ownerPool.query(
        'SELECT count(*)::int AS n FROM pg_stat_activity WHERE usename=$1',[ROLE]);
      assert.equal(active.rows[0].n,0);
      const row=(await ownerPool.query('SELECT revision,consent,deleted FROM '+
        SCHEMA+".accounts WHERE id='alice'")).rows[0];
      assert.deepEqual(row,{revision:'3',consent:false,deleted:false});
      const count=(await ownerPool.query('SELECT count(*)::int AS n FROM '+
        SCHEMA+".written WHERE id IN ('unsafe-before-drain','uncommitted-before-kill')")).rows[0].n;
      assert.equal(count,0,'all in-flight/rolled-back synthetic writes absent');
      const role=(await ownerPool.query(
        'SELECT rolcanlogin,rolpassword IS NULL AS password_erased'+
        ' FROM pg_authid WHERE rolname=$1',[ROLE])).rows[0];
      assert.deepEqual(role,{rolcanlogin:false,password_erased:true});
    } finally {
      if(!released) session.release(true);
    }
  });

  test.after(async()=>{
    try {if(writerPool)await writerPool.end();}
    finally{
      try{await ownerPool.query('DROP SCHEMA IF EXISTS '+SCHEMA+' CASCADE')}
      finally{
        try{await ownerPool.query('DROP ROLE IF EXISTS '+ROLE)}
        finally{
          try{await ownerPool.query('DROP ROLE IF EXISTS '+OWNER)}
          finally{await ownerPool.end();}
        }
      }
    }
  });
}
