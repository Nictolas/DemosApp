'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {Pool}=require('pg');
const Ledger=require('../services/privacyErasureLedgerService');

// Never let this test target any non-disposable database, even if accidentally
// supplied with an environment variable in a developer or CI environment.
const uri=process.env.TEST_DATABASE_URL||'';
if (!uri.endsWith('@localhost:5432/privacy_synthetic')) {
  test('GDPR secure bootstrap requires named synthetic localhost DB',{skip:true},()=>{});
} else {
  test('ledger first commit is RLS-protected; API grants remain revoked; event writes never do DDL',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    try{
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      const fixture={userId:'synthetic-test-user',eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,details:{source:'CI synthetic'}};
      await assert.rejects(Ledger.recordEvent(pool,fixture),e=>e?.code==='42P01');
      const absent=await pool.query("SELECT to_regclass('public.privacy_erasure_ledger') AS ledger");
      assert.equal(absent.rows[0].ledger,null,'a GDPR write cannot silently create schema');

      // Model the Supabase Data API roles on ephemeral PostgreSQL 17 only.
      for(const name of ['anon','authenticated','service_role']){
        await pool.query('CREATE ROLE '+name+' NOLOGIN NOBYPASSRLS');
      }
      await Ledger.ensureTable(pool);
      const protectedTable=await pool.query(`
        SELECT c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
          pg_get_userbyid(c.relowner)=current_user AS caller_is_owner
        FROM pg_catalog.pg_class c
        WHERE c.oid='public.privacy_erasure_ledger'::regclass
      `);
      assert.deepEqual(protectedTable.rows[0],{rls:true,forced:false,caller_is_owner:true});
      const queryPrivileges=async()=>{
        const r=await pool.query(`
          SELECT COUNT(*)::int AS n FROM pg_catalog.pg_roles
          WHERE rolname IN ('anon','authenticated','service_role')
            AND (has_table_privilege(rolname,'public.privacy_erasure_ledger','SELECT')
              OR has_table_privilege(rolname,'public.privacy_erasure_ledger','INSERT')
              OR has_table_privilege(rolname,'public.privacy_erasure_ledger','UPDATE')
              OR has_table_privilege(rolname,'public.privacy_erasure_ledger','DELETE'))
        `);
        return r.rows[0].n;
      };
      assert.equal(await queryPrivileges(),0,'no API role grants after initial provisioning');

      // Simulate an old table with excessive grants and re-run maintenance.
      await pool.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON
        public.privacy_erasure_ledger TO anon, authenticated, service_role`);
      assert.equal(await queryPrivileges(),3);
      await Ledger.ensureTable(pool);
      assert.equal(await queryPrivileges(),0,'idempotent bootstrap must strip inappropriate grants');

      // A table-level-only ACL check misses PostgreSQL column grants. Such
      // grants must fail closed even while a zero-policy RLS currently masks
      // reads, because a future restored policy could permit access.
      await pool.query('GRANT SELECT (subject_user_id) ON public.privacy_erasure_ledger TO anon');
      const columnGrant=await pool.query(`
        SELECT
          has_table_privilege('anon','public.privacy_erasure_ledger','SELECT') AS table_select,
          has_any_column_privilege('anon','public.privacy_erasure_ledger','SELECT') AS column_select
      `);
      assert.deepEqual(columnGrant.rows[0],{table_select:false,column_select:true});
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'a column-only anon grant must fail closed');
      await Ledger.ensureTable(pool);
      assert.equal(await queryPrivileges(),0,'reprovisioning must revoke column-level anon grants');
      await pool.query('GRANT SELECT (details) ON public.privacy_erasure_ledger TO PUBLIC');
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'PUBLIC column-level grants must fail closed');
      await Ledger.ensureTable(pool);
      await pool.query('GRANT UPDATE (details) ON public.privacy_erasure_ledger TO authenticated');
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'authenticated column-only UPDATE must fail closed');
      await Ledger.ensureTable(pool);

      // A restored or manually altered table may exist but lack the
      // protection needed to accept fresh consent/deletion history.
      await pool.query('ALTER TABLE public.privacy_erasure_ledger DISABLE ROW LEVEL SECURITY');
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'an existing unprotected restored table must reject GDPR events');
      assert.equal((await pool.query('SELECT COUNT(*)::integer AS n FROM public.privacy_erasure_ledger')).rows[0].n,0);
      await Ledger.ensureTable(pool);

      await pool.query('GRANT SELECT ON public.privacy_erasure_ledger TO PUBLIC');
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'PUBLIC table grants cannot be permitted even if RLS is on');
      await Ledger.ensureTable(pool);

      await pool.query('GRANT INSERT ON public.privacy_erasure_ledger TO anon');
      await assert.rejects(Ledger.recordEvent(pool,fixture),
        error=>error?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
        'Supabase API-role INSERT grant must be rejected before a write');
      await Ledger.ensureTable(pool);
      assert.equal(await queryPrivileges(),0);

      const recorded=await Ledger.recordEvent(pool,fixture);
      assert.equal(recorded.event_type,Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED);
      const one=await pool.query('SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger');
      assert.equal(one.rows[0].n,1,'secure re-provisioning must preserve GDPR history');
      const owner=await pool.query(`
        SELECT relrowsecurity AS rls FROM pg_catalog.pg_class
        WHERE oid='public.privacy_erasure_ledger'::regclass
      `);
      assert.equal(owner.rows[0].rls,true);
      // Model an independent backend SQL role on the same disposable PG17.
      // A table grant is insufficient if RLS has zero policies; no production
      // role identity or permission can be inferred from owner-only CI.
      await pool.query('CREATE ROLE gdpr_nonowner_ci NOLOGIN NOBYPASSRLS');
      await pool.query('GRANT USAGE ON SCHEMA public TO gdpr_nonowner_ci');
      await pool.query('GRANT SELECT, INSERT ON public.privacy_erasure_ledger TO gdpr_nonowner_ci');
      const nonowner=await pool.connect();
      try {
        await nonowner.query('SET ROLE gdpr_nonowner_ci');
        const identity=await nonowner.query('SELECT current_user AS current_role');
        assert.equal(identity.rows[0].current_role,'gdpr_nonowner_ci');
        await assert.rejects(Ledger.recordEvent(nonowner,fixture),
          error=>error?.code==='42501',
          'non-owner with INSERT grant but no RLS policy must be denied');
      } finally {
        await nonowner.query('RESET ROLE');
        nonowner.release();
      }
      assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger')).rows[0].n,1,
        'non-owner rejection must not create another event');

      // Prove the constrained non-owner path works on disposable PG17 too.
      // INSERT ... RETURNING needs both INSERT and SELECT RLS policies. This
      // is NOT a grant/policy recommendation for Render or production: the
      // actual backend SQL identity and provider isolation remain unknown.
      await pool.query(`CREATE POLICY gdpr_ci_backend_insert
        ON public.privacy_erasure_ledger FOR INSERT TO gdpr_nonowner_ci
        WITH CHECK (true)`);
      await pool.query(`CREATE POLICY gdpr_ci_backend_select
        ON public.privacy_erasure_ledger FOR SELECT TO gdpr_nonowner_ci
        USING (true)`);
      const allowed=await pool.connect();
      try {
        await allowed.query('BEGIN');
        await allowed.query('SET LOCAL ROLE gdpr_nonowner_ci');
        const identity=await allowed.query('SELECT current_user AS current_role');
        assert.equal(identity.rows[0].current_role,'gdpr_nonowner_ci');
        const inserted=await Ledger.recordEvent(allowed,{
          ...fixture, userId:'synthetic-nonowner-rls-authorized'
        });
        assert.equal(inserted.subject_user_id,'synthetic-nonowner-rls-authorized');
        assert.equal((await allowed.query(
          'SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger'
        )).rows[0].n,2,'RLS-authorized non-owner sees the synthetic event');
      } finally {
        await allowed.query('ROLLBACK');
        allowed.release();
      }
      assert.equal((await pool.query(
        'SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger'
      )).rows[0].n,1,'non-owner synthetic insert must roll back completely');
      assert.equal(await queryPrivileges(),0,
        'non-owner RLS policies must not grant Supabase API roles access');
      await pool.query('DROP POLICY gdpr_ci_backend_insert ON public.privacy_erasure_ledger');
      await pool.query('DROP POLICY gdpr_ci_backend_select ON public.privacy_erasure_ledger');
      await pool.query('REVOKE ALL ON public.privacy_erasure_ledger FROM gdpr_nonowner_ci');
      await pool.query('REVOKE USAGE ON SCHEMA public FROM gdpr_nonowner_ci');
      await pool.query('DROP ROLE gdpr_nonowner_ci');
    } finally {
      await pool.end();
    }
  });

  test('GDPR ledger failures roll back previously changed consent and account data',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const userId='synthetic-revocation-user';
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await pool.query(`
        CREATE TABLE users (id text PRIMARY KEY, political_opinions_consent boolean NOT NULL);
        CREATE TABLE political_selections (
          id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
          user_id text NOT NULL REFERENCES users(id)
        );
      `);
      await pool.query('INSERT INTO users(id, political_opinions_consent) VALUES ($1,true)',[userId]);
      await pool.query('INSERT INTO political_selections(user_id) VALUES ($1)',[userId]);
      await Ledger.ensureTable(pool);

      // Both actual HTTP routes keep event recording and preceding mutations
      // within one SQL transaction. Model those steps against real PG17.
      for (const failureMode of ['ledger_missing','rls_disabled','api_role_grant',
        'ledger_insert_suppressed','ledger_subject_rewritten','ledger_details_rewritten']) {
        if (failureMode==='ledger_missing') {
          await pool.query('DROP TABLE public.privacy_erasure_ledger');
        } else if (failureMode==='rls_disabled') {
          await pool.query('ALTER TABLE public.privacy_erasure_ledger DISABLE ROW LEVEL SECURITY');
        } else if (failureMode==='api_role_grant') {
          await pool.query('GRANT INSERT ON public.privacy_erasure_ledger TO anon');
        } else {
          // PG17-only adversarial trigger: a successful INSERT command may
          // return zero rows or a modified GDPR event without throwing.
          const action = failureMode==='ledger_insert_suppressed'
            ? 'RETURN NULL;'
            : failureMode==='ledger_subject_rewritten'
              ? "NEW.subject_user_id := 'synthetic-wrong-subject'; RETURN NEW;"
              : "NEW.details := '{\"altered\":true}'::jsonb; RETURN NEW;";
          await pool.query(`CREATE FUNCTION public.gdpr_ci_mutate_event()
            RETURNS trigger LANGUAGE plpgsql AS $trigger$
            BEGIN ${action} END $trigger$`);
          await pool.query(`CREATE TRIGGER gdpr_ci_mutate_event
            BEFORE INSERT ON public.privacy_erasure_ledger
            FOR EACH ROW EXECUTE FUNCTION public.gdpr_ci_mutate_event()`);
        }

        for (const operation of ['political_consent_revoked','account_deleted']) {
          const client=await pool.connect();
          try {
            await client.query('BEGIN');
            if (operation==='political_consent_revoked') {
              await client.query(
                'UPDATE users SET political_opinions_consent=false WHERE id=$1',[userId]
              );
              await client.query('DELETE FROM political_selections WHERE user_id=$1',[userId]);
            } else {
              await client.query('DELETE FROM political_selections WHERE user_id=$1',[userId]);
              await client.query('DELETE FROM users WHERE id=$1',[userId]);
            }
            await assert.rejects(
              Ledger.recordEvent(client,{
                userId,eventType:Ledger.EVENT_TYPES[operation==='account_deleted'?
                  'ACCOUNT_DELETED':'POLITICAL_CONSENT_REVOKED'],
                details:{source:'transactional-ci-fixture'}
              }),
              error=>error?.code===(failureMode==='ledger_missing'?
                '42P01':failureMode==='rls_disabled'||failureMode==='api_role_grant'
                  ? 'GDPR_LEDGER_SCHEMA_NOT_PROTECTED':'GDPR_LEDGER_INSERT_NOT_CONFIRMED'),
              'ledger defect must prevent commit after earlier user changes'
            );
          } finally {
            await client.query('ROLLBACK');
            client.release();
          }
          const snapshot=await pool.query(`
            SELECT u.political_opinions_consent AS consent,
              (SELECT COUNT(*)::int FROM political_selections WHERE user_id=$1) AS choices
            FROM users u WHERE u.id=$1
          `,[userId]);
          assert.deepEqual(snapshot.rows,[{consent:true,choices:1}],
            failureMode+' / '+operation+' must roll back every user mutation');
        }
        if (failureMode.startsWith('ledger_') && failureMode!=='ledger_missing') {
          await pool.query('DROP TRIGGER gdpr_ci_mutate_event ON public.privacy_erasure_ledger');
          await pool.query('DROP FUNCTION public.gdpr_ci_mutate_event()');
        }
        // Reinstall/protect schema ONLY between fixture phases, never in a
        // user-facing request: also preserves the subsequent phases' safety.
        await Ledger.ensureTable(pool);
      }

      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'UPDATE users SET political_opinions_consent=false WHERE id=$1',[userId]
        );
        await client.query('DELETE FROM political_selections WHERE user_id=$1',[userId]);
        await Ledger.recordEvent(client,{
          userId,eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
          details:{source:'synthetic-success'}
        });
        await client.query('COMMIT');
      } catch(e) {
        await client.query('ROLLBACK');throw e;
      } finally {client.release();}
      const after=await pool.query(`
        SELECT
          (SELECT political_opinions_consent FROM users WHERE id=$1) AS consent,
          (SELECT COUNT(*)::int FROM political_selections WHERE user_id=$1) AS choices,
          (SELECT COUNT(*)::int FROM public.privacy_erasure_ledger) AS ledger_events
      `,[userId]);
      assert.deepEqual(after.rows,[{consent:false,choices:0,ledger_events:1}],
        'after approved protected provisioning, transaction must commit once');
    } finally {
      await pool.end();
    }
  });

  test('GDPR capture, import and replay ignore a shadow ledger on the session search_path',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const revokeId='synthetic-public-revocation';
    const keepId='synthetic-shadow-must-survive';
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await pool.query(`
        CREATE TABLE public.users (
          id text PRIMARY KEY,
          political_opinions_consent boolean NOT NULL,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
        CREATE TABLE public.opinioni_risposte (user_id text NOT NULL, answer text);
        CREATE TABLE public.user_consents (
          user_id text PRIMARY KEY,
          political_opinions_consent boolean,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
      `);
      await pool.query('INSERT INTO public.users(id,political_opinions_consent) VALUES ($1,true),($2,true)',[revokeId,keepId]);
      await pool.query('INSERT INTO public.opinioni_risposte(user_id,answer) VALUES ($1,\'revoke\'),($2,\'keep\')',[revokeId,keepId]);
      await Ledger.ensureTable(pool);
      await Ledger.recordEvent(pool,{
        userId:revokeId,eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
        details:{source:'public-synthetic-ledger'}
      });

      const client=await pool.connect();
      try {
        // PostgreSQL resolves an unqualified relation through pg_temp first.
        // A stale restore session must never use that shadow for GDPR replay.
        await client.query('CREATE TEMP TABLE privacy_erasure_ledger (LIKE public.privacy_erasure_ledger INCLUDING ALL)');
        await client.query('SET search_path TO pg_temp, public');
        await client.query(`
          INSERT INTO privacy_erasure_ledger(event_key,subject_user_id,event_type,details)
          VALUES ('forged-temp-event',$1,'account_deleted','{}'::jsonb)
        `,[keepId]);

        const captured=await Ledger.captureCurrent(client);
        assert.equal(captured.length,1,'capture must read the protected public ledger');
        assert.equal(captured[0].subject_user_id,revokeId);
        assert.equal(captured[0].event_type,Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED);

        const imported=await Ledger.mergeCaptured(client,[{
          event_key:'synthetic-imported-event',
          subject_user_id:keepId,
          event_type:Ledger.EVENT_TYPES.POLITICAL_CONSENT_GRANTED,
          occurred_at:new Date().toISOString(),
          details:{source:'synthetic-import'}
        }]);
        assert.equal(imported,1);
        assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger')).rows[0].n,2,
          'import must write to public ledger, not the temporary shadow');
        assert.equal((await client.query('SELECT COUNT(*)::int AS n FROM pg_temp.privacy_erasure_ledger')).rows[0].n,1,
          'the forged temporary event must remain irrelevant');

        const replay=await Ledger.applyCurrentPrivacyState(client);
        assert.equal(replay.accountsRemoved,0,'a forged temp account deletion must not execute');
        assert.equal(replay.revocationsReapplied,1);
        assert.equal(replay.opinionsRemoved,1);
        const users=await client.query('SELECT id,political_opinions_consent AS consent FROM public.users ORDER BY id');
        assert.deepEqual(users.rows,[
          {id:revokeId,consent:false},
          {id:keepId,consent:true}
        ].sort((a,b)=>a.id.localeCompare(b.id)));
        const opinions=await client.query('SELECT user_id FROM public.opinioni_risposte');
        assert.deepEqual(opinions.rows,[{user_id:keepId}]);
      } finally {
        await client.query('RESET search_path');
        client.release();
      }
    } finally {
      await pool.end();
    }
  });

  test('GDPR capture preserves PostgreSQL microseconds for exact idempotent offline replay',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const event={
      event_key:'synthetic-microsecond-event',
      subject_user_id:'synthetic-precision-person',
      event_type:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
      occurred_at:'2026-01-02T03:04:05.123456Z',
      details:{source:'synthetic-microsecond-capture'}
    };
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await Ledger.ensureTable(pool);
      assert.equal(await Ledger.mergeCaptured(pool,[event]),1);

      // node-postgres parses TIMESTAMPTZ as a JS Date and silently drops
      // microseconds. Capture must export a precise UTC string instead.
      const captured=await Ledger.captureCurrent(pool);
      assert.equal(captured.length,1);
      assert.equal(captured[0].occurred_at,event.occurred_at,
        'a captured ledger event must retain all six fractional digits');
      assert.equal(await Ledger.mergeCaptured(pool,captured),0,
        'recapturing the same event must not be misidentified as a conflict');

      await pool.query('TRUNCATE public.privacy_erasure_ledger');
      assert.equal(await Ledger.mergeCaptured(pool,captured),1);
      const restored=await pool.query(`SELECT to_char(occurred_at AT TIME ZONE 'UTC',
        'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS precise_time
        FROM public.privacy_erasure_ledger WHERE event_key=$1`,[event.event_key]);
      assert.equal(restored.rows[0].precise_time,event.occurred_at,
        'export/import must preserve the exact PostgreSQL timestamp');

      await assert.rejects(
        Ledger.mergeCaptured(pool,[{...captured[0],occurred_at:'2026-01-02T03:04:05.123457Z'}]),
        error=>error?.code==='GDPR_LEDGER_EVENT_KEY_CONFLICT',
        'a one-microsecond change must still fail closed'
      );
    } finally {
      await pool.end();
    }
  });

  test('GDPR import preflights identities, timestamps and details before any batch write',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const valid={
      event_key:'synthetic-valid-batch-event',
      subject_user_id:'synthetic-valid-subject',
      event_type:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
      occurred_at:'2026-01-02T03:04:05.123456Z',
      details:{source:'synthetic-import'}
    };
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await Ledger.ensureTable(pool);

      // The first event is valid: rejecting a later malformed event must not
      // leave a partial import even when the caller omitted BEGIN/ROLLBACK.
      const circular={source:'synthetic-circular'};
      circular.self=circular;
      const invalid=[
        {...valid,event_key:'synthetic-null-subject',subject_user_id:null},
        {...valid,event_key:'synthetic-missing-subject',subject_user_id:undefined},
        {...valid,event_key:'synthetic-empty-subject',subject_user_id:''},
        {...valid,event_key:'synthetic-blank-subject',subject_user_id:'   '},
        {...valid,event_key:''},
        {...valid,event_key:undefined},
        {...valid,event_type:'unknown-event'},
        {...valid,event_key:'synthetic-missing-time',occurred_at:null},
        {...valid,event_key:'synthetic-invalid-time',occurred_at:'not-a-time'},
        {...valid,event_key:'synthetic-impossible-time',occurred_at:'2026-02-30T00:00:00.000000Z'},
        {...valid,event_key:'synthetic-date-object',
          occurred_at:new Date('2026-01-02T03:04:05.123Z')},
        {...valid,event_key:'synthetic-bigint',details:{value:1n}},
        {...valid,event_key:'synthetic-circular',details:circular},
        {...valid,event_key:'synthetic-undefined-json',details:Symbol('invalid')},
        // Malformed archives must not silently replace details with {}.
        {...valid,event_key:'synthetic-null-details',details:null},
        {...valid,event_key:'synthetic-undefined-details',details:undefined},
        {...valid,event_key:'synthetic-false-details',details:false},
        {...valid,event_key:'synthetic-zero-details',details:0},
        {...valid,event_key:'synthetic-array-details',details:[]},
        {...valid,event_key:'synthetic-string-details',details:'legacy-raw-json'},
        {...valid,event_key:'synthetic-date-details',details:new Date('2026-01-02T03:04:05Z')},
        valid // A duplicate within one captured batch must never be replayed.
      ];
      for (const row of invalid) {
        await assert.rejects(
          Ledger.mergeCaptured(pool,[valid,row]),
          error=>error?.code==='GDPR_LEDGER_INVALID_CAPTURED_EVENT',
          'malformed capture must fail before writing any valid preceding event'
        );
        const state=await pool.query('SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger');
        assert.equal(state.rows[0].n,0,'invalid batch must not leave any imported rows');
      }
      await assert.rejects(
        Ledger.mergeCaptured(pool,{event_key:'not-an-array'}),
        error=>error?.code==='GDPR_LEDGER_INVALID_CAPTURED_EVENT'
      );
      assert.equal(await Ledger.mergeCaptured(pool,[valid]),1,
        'a valid captured event must still import normally');
      let serializationCalls=0;
      const serializedOnce={...valid,event_key:'synthetic-single-serialization',
        details:{toJSON(){serializationCalls++;return {source:'synthetic-once'};}}};
      assert.equal(await Ledger.mergeCaptured(pool,[serializedOnce]),1);
      assert.equal(serializationCalls,1,'details must be serialized once before SQL');
    } finally {
      await pool.end();
    }
  });

  test('GDPR offline import accepts identical replays but rejects conflicting event keys',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const fixed={
      event_key:'synthetic-fixed-event',
      subject_user_id:'synthetic-person',
      event_type:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
      occurred_at:'2026-01-02T03:04:05.000Z',
      details:{source:'synthetic-b2'}
    };
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await Ledger.ensureTable(pool);
      assert.equal(await Ledger.mergeCaptured(pool,[fixed]),1);
      assert.equal(await Ledger.mergeCaptured(pool,[{...fixed,details:{source:'synthetic-b2'}}]),0,
        'an identical event may be replayed idempotently');

      const tampered=[
        {...fixed,subject_user_id:'different-synthetic-person'},
        {...fixed,event_type:Ledger.EVENT_TYPES.POLITICAL_CONSENT_GRANTED},
        {...fixed,occurred_at:'2026-01-02T03:04:06.000Z'},
        {...fixed,details:{source:'changed-synthetic-b2'}}
      ];
      for (const conflicting of tampered) {
        const client=await pool.connect();
        try {
          await client.query('BEGIN');
          await assert.rejects(
            Ledger.mergeCaptured(client,[
              {...fixed,event_key:'synthetic-batch-new-event'},
              conflicting
            ]),
            e=>e?.code==='GDPR_LEDGER_EVENT_KEY_CONFLICT',
            'same event_key with altered GDPR event data must fail closed'
          );
          await client.query('ROLLBACK');
        } finally {
          client.release();
        }
        const snapshot=await pool.query(`
          SELECT event_key,subject_user_id,event_type,occurred_at,details
          FROM public.privacy_erasure_ledger ORDER BY event_key
        `);
        assert.equal(snapshot.rows.length,1,'failed batch must not persist a partial import');
        assert.equal(snapshot.rows[0].event_key,fixed.event_key);
        assert.equal(snapshot.rows[0].subject_user_id,fixed.subject_user_id);
        assert.equal(snapshot.rows[0].event_type,fixed.event_type);
        assert.equal(snapshot.rows[0].occurred_at.toISOString(),fixed.occurred_at);
        assert.deepEqual(snapshot.rows[0].details,fixed.details);
      }
    } finally {
      await pool.end();
    }
  });

  test('GDPR import rejects trigger-mutated rows and rolls back earlier writes',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const event={
      event_key:'synthetic-import-verified',
      subject_user_id:'synthetic-import-person',
      event_type:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
      occurred_at:'2026-01-02T03:04:05.123456Z',
      details:{source:'synthetic-recovery'}
    };
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await Ledger.ensureTable(pool);
      await pool.query('CREATE TABLE public.gdpr_ci_import_marker(n integer NOT NULL)');
      await pool.query('INSERT INTO public.gdpr_ci_import_marker(n) VALUES (0)');
      await pool.query(`
        CREATE FUNCTION public.gdpr_ci_rewrite_import()
        RETURNS trigger LANGUAGE plpgsql AS $gdpr_ci$
        BEGIN
          CASE current_setting('gdpr_ci.import_mode',true)
            WHEN 'subject' THEN
              NEW.subject_user_id := 'synthetic-forged-person';
            WHEN 'details' THEN
              NEW.details := '{"rewritten":true}'::jsonb;
            WHEN 'time' THEN
              NEW.occurred_at := NEW.occurred_at + INTERVAL '1 microsecond';
            WHEN 'key' THEN
              NEW.event_key := NEW.event_key || '-rewritten';
            WHEN 'suppressed' THEN
              RETURN NULL;
          END CASE;
          RETURN NEW;
        END $gdpr_ci$;
        CREATE TRIGGER gdpr_ci_rewrite_import
        BEFORE INSERT ON public.privacy_erasure_ledger
        FOR EACH ROW EXECUTE FUNCTION public.gdpr_ci_rewrite_import()
      `);
      for (const mode of ['subject','details','time','key','suppressed']) {
        const client=await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query("SELECT set_config('gdpr_ci.import_mode',$1,true)",[mode]);
          await client.query('UPDATE public.gdpr_ci_import_marker SET n=n+1');
          await assert.rejects(
            Ledger.mergeCaptured(client,[event]),
            error=>error?.code===(mode==='suppressed'
              ? 'GDPR_LEDGER_EVENT_KEY_CONFLICT':'GDPR_LEDGER_IMPORT_NOT_CONFIRMED'),
            mode+' must never be reported as a successful GDPR import'
          );
        } finally {
          await client.query('ROLLBACK');
          client.release();
        }
        assert.equal((await pool.query('SELECT n FROM public.gdpr_ci_import_marker')).rows[0].n,0,
          'failed import must roll back earlier synthetic transaction writes');
        assert.equal((await pool.query(
          'SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger'
        )).rows[0].n,0,'failed import must leave no forged GDPR event');
      }
      await pool.query('DROP TRIGGER gdpr_ci_rewrite_import ON public.privacy_erasure_ledger');
      await pool.query('DROP FUNCTION public.gdpr_ci_rewrite_import()');
      assert.equal(await Ledger.mergeCaptured(pool,[event]),1,
        'unchanged event must import after removing adversarial trigger');
      assert.equal(await Ledger.mergeCaptured(pool,[event]),0,
        'an identical replay must remain idempotent');
    } finally {
      await pool.end();
    }
  });

  test('GDPR replay targets public account and opinion tables despite temp shadows',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const eraseId='synthetic-delete-public';
    const revokeId='synthetic-revoke-public';
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await pool.query(`
        CREATE TABLE public.users (
          id text PRIMARY KEY,
          political_opinions_consent boolean NOT NULL,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
        CREATE TABLE public.opinioni_risposte (user_id text NOT NULL, answer text);
        CREATE TABLE public.user_consents (
          user_id text PRIMARY KEY,
          political_opinions_consent boolean,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
      `);
      await pool.query('INSERT INTO public.users(id,political_opinions_consent) VALUES ($1,true),($2,true)',[eraseId,revokeId]);
      await pool.query('INSERT INTO public.opinioni_risposte(user_id,answer) VALUES ($1,\'delete\'),($2,\'revoke\')',[eraseId,revokeId]);
      await Ledger.ensureTable(pool);
      await Ledger.recordEvent(pool,{
        userId:eraseId,eventType:Ledger.EVENT_TYPES.ACCOUNT_DELETED,
        details:{source:'synthetic-account-deletion'}
      });
      await Ledger.recordEvent(pool,{
        userId:revokeId,eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
        details:{source:'synthetic-consent-revocation'}
      });

      const client=await pool.connect();
      try {
        // Both public tables exist and were verified via information_schema,
        // but pg_temp shadows would intercept unqualified DELETE/UPDATE.
        await client.query('CREATE TEMP TABLE users (LIKE public.users INCLUDING ALL)');
        await client.query('CREATE TEMP TABLE opinioni_risposte (LIKE public.opinioni_risposte INCLUDING ALL)');
        await client.query('INSERT INTO pg_temp.users SELECT * FROM public.users');
        await client.query('INSERT INTO pg_temp.opinioni_risposte SELECT * FROM public.opinioni_risposte');
        await client.query('SET search_path TO pg_temp, public');

        const replay=await Ledger.applyCurrentPrivacyState(client);
        assert.equal(replay.accountsRemoved,1,'account deletion must affect the public account');
        assert.equal(replay.revocationsReapplied,1);
        assert.equal(replay.opinionsRemoved,1,'revocation must delete the public opinion');
        const publicAccounts=await client.query('SELECT id, political_opinions_consent AS consent FROM public.users ORDER BY id');
        assert.deepEqual(publicAccounts.rows,[{id:revokeId,consent:false}]);
        const publicOpinions=await client.query('SELECT user_id FROM public.opinioni_risposte');
        assert.deepEqual(publicOpinions.rows,[],'no withdrawn or deleted public opinions may survive');
        const tempAccounts=await client.query('SELECT id, political_opinions_consent AS consent FROM pg_temp.users ORDER BY id');
        assert.deepEqual(tempAccounts.rows,[{id:eraseId,consent:true},{id:revokeId,consent:true}]);
        const tempOpinions=await client.query('SELECT user_id FROM pg_temp.opinioni_risposte ORDER BY user_id');
        assert.deepEqual(tempOpinions.rows,[{user_id:eraseId},{user_id:revokeId}],
          'replay must not mutate shadow tables');
      } finally {
        await client.query('RESET search_path');
        client.release();
      }
    } finally {
      await pool.end();
    }
  });


  test('GDPR replay rejects incomplete restored core schema before mutating consent or opinions',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const userId='synthetic-incomplete-restore-user';
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await pool.query(`
        CREATE TABLE public.users (
          id text PRIMARY KEY,
          political_opinions_consent boolean NOT NULL,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
        CREATE TABLE public.opinioni_risposte (user_id text, answer text);
      `);
      await pool.query('INSERT INTO public.users(id,political_opinions_consent) VALUES ($1,true)',[userId]);
      await pool.query('INSERT INTO public.opinioni_risposte(user_id,answer) VALUES ($1,$2)',[userId,'synthetic opinion']);
      await Ledger.ensureTable(pool);
      await Ledger.recordEvent(pool,{
        userId,eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
        details:{source:'synthetic-incomplete-restore'}
      });
      const assertUnchanged=async()=>{
        assert.equal((await pool.query('SELECT political_opinions_consent AS consent FROM public.users WHERE id=$1',[userId])).rows[0].consent,true);
        assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM public.opinioni_risposte WHERE user_id=$1',[userId])).rows[0].n,1);
      };
      await assert.rejects(Ledger.applyCurrentPrivacyState(pool),
        e=>e?.code==='GDPR_REPLAY_SCHEMA_INCOMPLETE','missing user_consents must block replay');
      await assertUnchanged();

      await pool.query(`
        CREATE TABLE public.user_consents (
          user_id text PRIMARY KEY,
          political_opinions_consent boolean,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        )
      `);
      await pool.query('ALTER TABLE public.users DROP COLUMN political_opinions_consent_user_agent');
      await assert.rejects(Ledger.applyCurrentPrivacyState(pool),
        e=>e?.code==='GDPR_REPLAY_SCHEMA_INCOMPLETE','missing core consent column must block replay');
      await assertUnchanged();

      await pool.query('ALTER TABLE public.users ADD COLUMN political_opinions_consent_user_agent text');
      const replay=await Ledger.applyCurrentPrivacyState(pool);
      assert.equal(replay.revocationsReapplied,1);
      assert.equal(replay.opinionsRemoved,1);
      assert.equal((await pool.query('SELECT political_opinions_consent AS consent FROM public.users WHERE id=$1',[userId])).rows[0].consent,false);
      assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM public.opinioni_risposte WHERE user_id=$1',[userId])).rows[0].n,0);
    } finally {
      await pool.end();
    }
  });

  test('offline capture, import and replay reject partially visible RLS event journal',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const role='gdpr_partial_recovery_ci';
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await Ledger.ensureTable(pool);
      for(const userId of ['synthetic-visible','synthetic-hidden']){
        await Ledger.recordEvent(pool,{
          userId,
          eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
          details:{source:'synthetic-partial-visibility'}
        });
      }
      await pool.query('CREATE ROLE '+role+' NOLOGIN NOBYPASSRLS');
      await pool.query('GRANT USAGE ON SCHEMA public TO '+role);
      await pool.query('GRANT SELECT,INSERT ON public.privacy_erasure_ledger TO '+role);
      await pool.query('CREATE POLICY gdpr_ci_partial_export '+
        'ON public.privacy_erasure_ledger FOR SELECT TO '+role+
        " USING (subject_user_id='synthetic-visible')");
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE '+role);
        assert.equal((await client.query(
          'SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger'
        )).rows[0].n,1,'restricted role can see only 1/2 synthetic events');
        const partial=[{
          event_key:'synthetic-import',
          subject_user_id:'synthetic-visible',
          event_type:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
          occurred_at:'2026-01-02T03:04:05.000000Z',
          details:{source:'synthetic'}
        }];
        for (const [name,run] of [
          ['capture',()=>Ledger.captureCurrent(client)],
          ['import',()=>Ledger.mergeCaptured(client,partial)],
          ['replay',()=>Ledger.applyCurrentPrivacyState(client)]
        ]) {
          await assert.rejects(run(),
            error=>error?.code==='GDPR_LEDGER_VISIBILITY_INCOMPLETE',
            name+' must not treat a filtered ledger as complete');
        }
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
      assert.equal((await pool.query(
        'SELECT COUNT(*)::int AS n FROM public.privacy_erasure_ledger'
      )).rows[0].n,2,'rejected operations must preserve the full journal');
      await pool.query('DROP POLICY gdpr_ci_partial_export ON public.privacy_erasure_ledger');
      await pool.query('REVOKE ALL ON public.privacy_erasure_ledger FROM '+role);
      await pool.query('REVOKE USAGE ON SCHEMA public FROM '+role);
      await pool.query('DROP ROLE '+role);
      assert.equal((await Ledger.captureCurrent(pool)).length,2,
        'owner role may capture the complete synthetic journal');
    } finally {
      await pool.end();
    }
  });

  test('replay rejects SQL role with complete ledger but RLS-hidden restored users',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const role='gdpr_ci_unfiltered_ledger_hidden_users';
    const deletedAccount='synthetic-restored-hidden-user';
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await Ledger.ensureTable(pool);
      await pool.query(`
        CREATE TABLE public.users (
          id text PRIMARY KEY,
          political_opinions_consent boolean,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
        CREATE TABLE public.user_consents (
          user_id text PRIMARY KEY,
          political_opinions_consent boolean,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
        CREATE TABLE public.opinioni_risposte (user_id text);
      `);
      await pool.query('INSERT INTO public.users(id) VALUES ($1)',[deletedAccount]);
      await Ledger.recordEvent(pool,{
        userId:deletedAccount,
        eventType:Ledger.EVENT_TYPES.ACCOUNT_DELETED,
        details:{source:'synthetic-account-recovery'}
      });
      await pool.query('CREATE ROLE '+role+' NOLOGIN NOBYPASSRLS NOSUPERUSER');
      await pool.query('GRANT USAGE ON SCHEMA public TO '+role);
      // Ledger owner bypasses its RLS, but remains constrained by RLS on
      // the independent restored users table. This is a real PG17 role,
      // not a mock of a 0-row DELETE.
      await pool.query('ALTER TABLE public.privacy_erasure_ledger OWNER TO '+role);
      await pool.query('GRANT SELECT,DELETE ON public.users TO '+role);
      await pool.query('ALTER TABLE public.users ENABLE ROW LEVEL SECURITY');
      const client=await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SET LOCAL ROLE '+role);
        assert.equal((await client.query(
          "SELECT NOT pg_catalog.row_security_active("+
          "'public.privacy_erasure_ledger'::regclass) AS complete"
        )).rows[0].complete,true);
        assert.equal((await client.query(
          'SELECT COUNT(*)::int AS n FROM public.users'
        )).rows[0].n,0,'user row is hidden by the separate RLS policy');
        await assert.rejects(
          Ledger.applyCurrentPrivacyState(client),
          error=>error?.code==='GDPR_REPLAY_DATA_VISIBILITY_INCOMPLETE',
          'visible tombstones must never certify deletions in filtered app tables'
        );
      } finally {
        await client.query('ROLLBACK');
        client.release();
      }
      assert.equal((await pool.query(
        'SELECT COUNT(*)::int AS n FROM public.users WHERE id=$1',
        [deletedAccount]
      )).rows[0].n,1,
        'refused replay must leave source data unchanged');
      await pool.query('ALTER TABLE public.privacy_erasure_ledger OWNER TO postgres');
      await pool.query('REVOKE ALL ON public.users FROM '+role);
      await pool.query('REVOKE USAGE ON SCHEMA public FROM '+role);
      await pool.query('DROP ROLE '+role);
      assert.equal((await Ledger.applyCurrentPrivacyState(pool)).accountsRemoved,1,
        'privileged synthetic replay can delete the restored account');
    } finally {
      await pool.end();
    }
  });

  test('missing or unprotected ledger must block capture, import and replay without auto-provisioning',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const synthetic=[{
      event_key:'synthetic-restore-event',
      subject_user_id:'synthetic-restore-user',
      event_type:Ledger.EVENT_TYPES.ACCOUNT_DELETED,
      occurred_at:'2026-02-03T04:05:06.000Z',
      details:{source:'synthetic-recovery'}
    }];
    const operations=[
      ['capture',()=>Ledger.captureCurrent(pool)],
      ['import',()=>Ledger.mergeCaptured(pool,synthetic)],
      ['replay',()=>Ledger.applyCurrentPrivacyState(pool)]
    ];
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      for(const [name,operation] of operations) {
        await assert.rejects(operation(),e=>e?.code==='42P01',
          name+' must fail instead of manufacturing a clean empty ledger');
      }
      assert.equal((await pool.query("SELECT to_regclass('public.privacy_erasure_ledger') AS ledger")).rows[0].ledger,null,
        'offline helpers must not create missing restore evidence');
      await Ledger.ensureTable(pool);
      await pool.query('ALTER TABLE public.privacy_erasure_ledger DISABLE ROW LEVEL SECURITY');
      for(const [name,operation] of operations) {
        await assert.rejects(operation(),e=>e?.code==='GDPR_LEDGER_SCHEMA_NOT_PROTECTED',
          name+' must reject a restored ledger without RLS');
      }
      assert.equal((await pool.query('SELECT COUNT(*)::integer AS n FROM public.privacy_erasure_ledger')).rows[0].n,0,
        'unprotected ledger must remain empty after rejected import');
      await Ledger.ensureTable(pool);
      assert.deepEqual(await Ledger.captureCurrent(pool),[]);
      assert.equal(await Ledger.mergeCaptured(pool,synthetic),1);
      const recorded=await Ledger.captureCurrent(pool);
      assert.equal(recorded.length,1);
      assert.equal(recorded[0].subject_user_id,synthetic[0].subject_user_id);
      // A protected ledger alone is insufficient: a partial restore lacking
      // the core user/consent schema must not be declared successfully replayed.
      await assert.rejects(Ledger.applyCurrentPrivacyState(pool),
        e=>e?.code==='GDPR_REPLAY_SCHEMA_INCOMPLETE');
      await pool.query(`
        CREATE TABLE public.users (
          id text PRIMARY KEY,
          political_opinions_consent boolean,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
        CREATE TABLE public.opinioni_risposte (user_id text);
        CREATE TABLE public.user_consents (
          user_id text PRIMARY KEY,
          political_opinions_consent boolean,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
      `);
      assert.deepEqual(await Ledger.applyCurrentPrivacyState(pool),{
        accountsRemoved:0,dependentRowsRemoved:0,revocationsReapplied:0,opinionsRemoved:0
      });
    } finally {
      await pool.end();
    }
  });


  test('restore replay mirrors live consent cleanup and ignores pg_temp shadow users',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const userId='synthetic-revoked-with-votes';
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await pool.query(`
        CREATE TABLE public.users (
          id text PRIMARY KEY,
          political_opinions_consent boolean NOT NULL,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz,
          answer text,
          opinione_proposta_id text
        );
        CREATE TABLE public.opinioni_risposte (user_id text, answer text);
        CREATE TABLE public.voti_ice (user_id text, vote text);
        CREATE TABLE public.user_consents (
          user_id text PRIMARY KEY,
          political_opinions_consent boolean,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
      `);
      await pool.query(
        'INSERT INTO public.users(id,political_opinions_consent,answer,opinione_proposta_id) VALUES ($1,true,$2,$3)',
        [userId,'public-legacy-answer','public-proposal']
      );
      await pool.query('INSERT INTO public.opinioni_risposte(user_id,answer) VALUES ($1,$2)',
        [userId,'synthetic-opinion']);
      await pool.query('INSERT INTO public.voti_ice(user_id,vote) VALUES ($1,$2)',
        [userId,'synthetic-vote']);
      await pool.query('INSERT INTO public.user_consents(user_id,political_opinions_consent) VALUES ($1,true)',[userId]);
      await Ledger.ensureTable(pool);
      await Ledger.recordEvent(pool,{
        userId,eventType:Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED,
        details:{source:'synthetic-restore-consent'}
      });

      const client=await pool.connect();
      try {
        await client.query('CREATE TEMP TABLE users (LIKE public.users)');
        await client.query(
          'INSERT INTO pg_temp.users(id,political_opinions_consent,answer,opinione_proposta_id) VALUES ($1,true,$2,$3)',
          [userId,'shadow-answer','shadow-proposal']
        );
        await client.query('SET search_path TO pg_temp, public');
        const replay=await Ledger.applyCurrentPrivacyState(client);
        assert.equal(replay.revocationsReapplied,1);
        assert.equal(replay.opinionsRemoved,1);
        const publicUser=await client.query(
          'SELECT political_opinions_consent AS consent, answer, opinione_proposta_id AS proposal FROM public.users WHERE id=$1',
          [userId]
        );
        assert.deepEqual(publicUser.rows,[{consent:false,answer:null,proposal:null}],
          'restore replay must clear the real legacy opinion/proposal fields');
        const publicConsent=await client.query(
          'SELECT political_opinions_consent AS consent FROM public.user_consents WHERE user_id=$1',[userId]
        );
        assert.deepEqual(publicConsent.rows,[{consent:false}]);
        const votes=await client.query('SELECT COUNT(*)::int AS n FROM public.voti_ice WHERE user_id=$1',[userId]);
        assert.equal(votes.rows[0].n,0,'restore must not resurrect consent-scoped votes');
        const opinions=await client.query('SELECT COUNT(*)::int AS n FROM public.opinioni_risposte WHERE user_id=$1',[userId]);
        assert.equal(opinions.rows[0].n,0);
        const shadow=await client.query(
          'SELECT political_opinions_consent AS consent, answer, opinione_proposta_id AS proposal FROM pg_temp.users WHERE id=$1',
          [userId]
        );
        assert.deepEqual(shadow.rows,[{consent:true,answer:'shadow-answer',proposal:'shadow-proposal'}],
          'a temporary table must never divert real GDPR cleanup');
      } finally {
        await client.query('RESET search_path');
        client.release();
      }
    } finally {
      await pool.end();
    }
  });


  test('replay refuses equal-timestamp grant/revoke ambiguity before any account or opinion deletion',async()=>{
    const pool=new Pool({connectionString:uri,max:2});
    const revokedId='synthetic-timestamp-tie';
    const deletedId='synthetic-account-before-tie';
    try {
      await pool.query('DROP SCHEMA public CASCADE');
      await pool.query('CREATE SCHEMA public');
      await pool.query(`
        CREATE TABLE public.users (
          id text PRIMARY KEY,
          political_opinions_consent boolean,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
        CREATE TABLE public.opinioni_risposte (user_id text, answer text);
        CREATE TABLE public.user_consents (
          user_id text PRIMARY KEY,
          political_opinions_consent boolean,
          political_opinions_consent_timestamp timestamptz,
          political_opinions_consent_ip_address text,
          political_opinions_consent_user_agent text,
          updated_at timestamptz
        );
      `);
      await pool.query('INSERT INTO public.users(id,political_opinions_consent) VALUES ($1,true),($2,true)',
        [revokedId,deletedId]);
      await pool.query('INSERT INTO public.opinioni_risposte(user_id,answer) VALUES ($1,$3),($2,$3)',
        [revokedId,deletedId,'synthetic opinion']);
      await pool.query('INSERT INTO public.user_consents(user_id,political_opinions_consent) VALUES ($1,true)',
        [revokedId]);
      await Ledger.ensureTable(pool);
      const tie='2026-10-27T08:00:00.123456Z';
      await pool.query(`
        INSERT INTO public.privacy_erasure_ledger
          (event_key,subject_user_id,event_type,occurred_at,details)
        VALUES
          ('synthetic-tie-revoke',$1,'political_consent_revoked',$3::timestamptz,'{}'::jsonb),
          ('synthetic-tie-grant',$1,'political_consent_granted',$3::timestamptz,'{}'::jsonb),
          ('synthetic-delete',$2,'account_deleted',$3::timestamptz,'{}'::jsonb)
      `,[revokedId,deletedId,tie]);
      await assert.rejects(Ledger.applyCurrentPrivacyState(pool),
        e=>e?.code==='GDPR_LEDGER_AMBIGUOUS_CONSENT_ORDER',
        'random event keys cannot establish the order of contradictory consent events');
      assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM public.users')).rows[0].n,2,
        'even a preceding account deletion must not partially execute');
      assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM public.opinioni_risposte')).rows[0].n,2,
        'no opinion may be changed before the ambiguity gate');
      assert.equal((await pool.query('SELECT political_opinions_consent AS consent FROM public.user_consents WHERE user_id=$1',
        [revokedId])).rows[0].consent,true);

      // With the conflicting grant removed, the same synthetic replay can run.
      await pool.query("DELETE FROM public.privacy_erasure_ledger WHERE event_key='synthetic-tie-grant'");
      const result=await Ledger.applyCurrentPrivacyState(pool);
      assert.equal(result.accountsRemoved,1);
      assert.equal(result.revocationsReapplied,1);
      assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM public.users WHERE id=$1',[deletedId])).rows[0].n,0);
      assert.equal((await pool.query('SELECT COUNT(*)::int AS n FROM public.opinioni_risposte')).rows[0].n,0);
      assert.equal((await pool.query('SELECT political_opinions_consent AS consent FROM public.user_consents WHERE user_id=$1',
        [revokedId])).rows[0].consent,false);
    } finally {
      await pool.end();
    }
  });

}
