'use strict';

// PostgreSQL 17 localhost CI only: canonical/legacy supporters and notifications.
// All fixtures are synthetic on disposable PG17 in one rolled-back transaction.
// Canonical supporter, push and notification I/O targets public exclusively.
// Contradictory pg_temp copies simulate hostile borrowed-connection search_path.
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { loadSupporterUserIds } = require('../services/politicalSelectionService');
const { loadCurrentSupporterTokens } = require('../services/currentSupporterPushService');
const { createSupporterOpinionNotifications } = require('../services/politicalOpinionNotificationService');

async function main() {
  const expected = {
    GITHUB_ACTIONS: 'true', POLITICAL_CONSENT_RACE_CI: 'synthetic',
    PGHOST: '127.0.0.1', PGPORT: '5432',
    PGDATABASE: 'political_consent_race_ci',
    PGUSER: 'postgres', PGPASSWORD: 'synthetic-only'
  };
  for (const [key, value] of Object.entries(expected)) {
    if (process.env[key] !== value) throw Error('Refusing non-synthetic CI: ' + key);
  }
  for (const key of ['DATABASE_URL', 'SUPABASE_URL', 'SUPABASE_DB_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'RENDER']) {
    if (process.env[key]) throw Error('Refusing production environment: ' + key);
  }
  const db = new Pool({
    host: '127.0.0.1', port: 5432, database: 'political_consent_race_ci',
    user: 'postgres', password: 'synthetic-only', max: 1,
    connectionTimeoutMillis: 3500, application_name: 'synthetic_supporter_consent'
  });
  let client;
  try {
    client = await db.connect();
    const meta = (await client.query("SELECT current_database() db, current_setting('server_version_num')::integer version")).rows[0];
    assert.equal(meta.db, 'political_consent_race_ci');
    assert.equal(Math.floor(meta.version / 10000), 17);
    await client.query('BEGIN');
    // This test runs BEFORE the canonical-selection write drill in CI.
    // Create its synthetic canonical relation within the rollback-only
    // transaction instead of depending on a later workflow step.
    await client.query(
      'CREATE TABLE IF NOT EXISTS public.political_selections (' +
      'user_id uuid NOT NULL,selection_kind text NOT NULL,' +
      'jurisdiction_id text NOT NULL,political_office_id text NOT NULL,' +
      'selected_user_id uuid NOT NULL,selected_candidacy_id uuid,' +
      'selected_mandate_id uuid,source text,context jsonb,' +
      'updated_at timestamptz DEFAULT NOW(),' +
      'UNIQUE (user_id,selection_kind,political_office_id))'
    );
    // Other CI scripts create public.users/consents/selections in this same
    // disposable PG17 database. Populate only made-up IDs, and ROLLBACK
    // every public change (including fixture columns) at the end.
    await client.query("ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status text DEFAULT 'a'");
    await client.query('ALTER TABLE public.users ADD COLUMN IF NOT EXISTS rappresentante_camera uuid');
    await client.query(
      'ALTER TABLE public.users ADD COLUMN IF NOT EXISTS fcm_tokens text[] DEFAULT ARRAY[]::text[]'
    );
    // Canonical relations exist only within this synthetic transaction (or
    // were created in this disposable CI database by an earlier drill).
    await client.query(
      'CREATE TABLE IF NOT EXISTS public.user_devices ' +
      '(user_id uuid, is_active boolean, fcm_token text)'
    );
    await client.query(
      'CREATE TABLE IF NOT EXISTS public.opinioni_domande ' +
      '(id text PRIMARY KEY, text text)'
    );
    await client.query(
      'CREATE TABLE IF NOT EXISTS public.political_opinion_notifications (' +
      'id uuid PRIMARY KEY DEFAULT gen_random_uuid(),' +
      'recipient_user_id uuid,subject_user_id uuid,opinion_id text,' +
      'opinion_text text,previous_value text,new_value text)'
    );
    await client.query('CREATE TEMP TABLE users (id uuid PRIMARY KEY, status text NOT NULL, political_opinions_consent boolean, fcm_tokens text[] DEFAULT ARRAY[]::text[], rappresentante_camera uuid)');
    await client.query('CREATE TEMP TABLE user_consents (user_id uuid PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE political_selections (user_id uuid, selection_kind text, political_office_id text, selected_user_id uuid)');
    await client.query('CREATE TEMP TABLE user_devices (user_id uuid, is_active boolean, fcm_token text)');
    await client.query('CREATE TEMP TABLE opinioni_domande (id text PRIMARY KEY, text text)');
    await client.query('CREATE TEMP TABLE political_opinion_notifications (id uuid DEFAULT gen_random_uuid() PRIMARY KEY, recipient_user_id uuid, subject_user_id uuid, opinion_id text, opinion_text text, previous_value text, new_value text)');

    const subject = '00000000-0000-4000-8000-000000000301';
    const granted = '00000000-0000-4000-8000-000000000302';
    const revoked = '00000000-0000-4000-8000-000000000303';
    const fallback = '00000000-0000-4000-8000-000000000304';
    await client.query(
      "INSERT INTO public.users(id,status,political_opinions_consent,rappresentante_camera,fcm_tokens) " +
      "VALUES ($1,'a',true,NULL,ARRAY[]::text[])," +
      "($2,'a',true,$1,ARRAY['token-granted'])," +
      "($3,'a',true,$1,ARRAY['token-revoked'])," +
      "($4,'a',true,$1,ARRAY['token-fallback']) " +
      "ON CONFLICT (id) DO UPDATE SET " +
      "status=EXCLUDED.status,political_opinions_consent=EXCLUDED.political_opinions_consent," +
      "rappresentante_camera=EXCLUDED.rappresentante_camera,fcm_tokens=EXCLUDED.fcm_tokens",
      [subject,granted,revoked,fallback]
    );
    await client.query(
      'INSERT INTO public.user_consents(user_id,political_opinions_consent) ' +
      'VALUES ($1,true),($2,false) ON CONFLICT (user_id) DO UPDATE SET ' +
      'political_opinions_consent=EXCLUDED.political_opinions_consent',
      [granted,revoked]
    );
    await client.query(
      "INSERT INTO public.political_selections " +
      "(user_id,selection_kind,jurisdiction_id,political_office_id,selected_user_id,source,context) " +
      "VALUES ($1,'representative','it','it.camera',$4,'matching','{}'::jsonb)," +
      "($2,'representative','it','it.camera',$4,'matching','{}'::jsonb)," +
      "($3,'representative','it','it.camera',$4,'matching','{}'::jsonb) " +
      "ON CONFLICT (user_id,selection_kind,political_office_id) DO UPDATE SET " +
      "selected_user_id=EXCLUDED.selected_user_id",
      [granted,revoked,fallback,subject]
    );
    await client.query(
      'DELETE FROM public.user_devices WHERE user_id=ANY($1::uuid[])',
      [[subject,granted,revoked,fallback]]
    );
    await client.query(
      "INSERT INTO public.user_devices(user_id,is_active,fcm_token) " +
      "VALUES ($1,true,'device-granted'),($2,true,'device-revoked')",
      [granted,revoked]
    );
    await client.query(
      "INSERT INTO public.opinioni_domande(id,text) VALUES ('42','Synthetic opinion') " +
      'ON CONFLICT (id) DO UPDATE SET text=EXCLUDED.text'
    );
    await client.query(
      'DELETE FROM public.political_opinion_notifications WHERE subject_user_id=$1',
      [subject]
    );
    // Opposite shadow grants and unrelated tokens MUST never determine push
    // recipients. All pg_temp fixture mutations remain rollback-only.
    await client.query(
      "INSERT INTO users(id,status,political_opinions_consent,fcm_tokens,rappresentante_camera) " +
      "VALUES ($1,'a',true,ARRAY[]::text[],NULL)," +
      "($2,'a',true,ARRAY['shadow-granted'],$1)," +
      "($3,'a',true,ARRAY['shadow-revoked'],$1)," +
      "($4,'a',true,ARRAY['shadow-fallback'],$1)",
      [subject,granted,revoked,fallback]
    );
    await client.query(
      'INSERT INTO user_consents(user_id,political_opinions_consent) VALUES ($1,false),($2,true)',
      [granted,revoked]
    );
    await client.query("INSERT INTO political_selections(user_id,selection_kind,political_office_id,selected_user_id) VALUES ($1,'representative','it.camera',$4),($2,'representative','it.camera',$4),($3,'representative','it.camera',$4)", [granted,revoked,fallback,subject]);
    await client.query(
      "INSERT INTO user_devices(user_id,is_active,fcm_token) " +
      "VALUES ($1,true,'shadow-device-granted'),($2,true,'shadow-device-revoked')",
      [granted,revoked]
    );
    await client.query("INSERT INTO opinioni_domande(id,text) VALUES ('42','SHADOW opinion')");
    await client.query('SET LOCAL search_path = pg_temp, public');

    // A SAVEPOINT mimics independent pool.query statement error isolation
    // while retaining TEMP tables within the fixture transaction.
    const pg = { async query(sql, params) {
      await client.query('SAVEPOINT synthetic_statement');
      try {
        const result = await client.query(sql, params);
        await client.query('RELEASE SAVEPOINT synthetic_statement');
        return result;
      } catch (e) {
        await client.query('ROLLBACK TO SAVEPOINT synthetic_statement');
        await client.query('RELEASE SAVEPOINT synthetic_statement');
        throw e;
      }
    } };
    const opts = { selectedUserId: subject, kind: 'representative', officeId: 'it.camera' };
    let supporters = await loadSupporterUserIds(pg, opts);
    assert.equal(supporters.source, 'CANONICAL');
    assert.deepEqual(supporters.userIds.sort(), [fallback, granted].sort());

    let rows = await loadCurrentSupporterTokens(pg, {
      subjectUserId: subject, kind: 'representative', level: 'CAMERA'
    });
    let tokens = new Map(rows.map(x => [String(x.userId), x.tokens]));
    assert.deepEqual(tokens.get(granted).sort(), ['device-granted', 'token-granted'].sort());
    assert.deepEqual(tokens.get(fallback), ['token-fallback']);
    assert.equal(tokens.has(revoked), false);
    assert.ok(![...tokens.values()].flat().some(token=>token.startsWith('shadow-')),
      'canonical token lookup must exclude shadow tokens');
    const unavailableDevice={ async query(sql,params){
      if(String(sql).includes('FROM public.user_devices d')){
        const absent=Error('synthetic public device relation unavailable');
        absent.code='42P01';
        throw absent;
      }
      return pg.query(sql,params);
    } };
    const fallbackTokens=await loadCurrentSupporterTokens(unavailableDevice,{
      subjectUserId:subject,kind:'representative',level:'CAMERA'
    });
    const byUser=new Map(fallbackTokens.map(x=>[String(x.userId),x.tokens]));
    assert.deepEqual(byUser.get(granted),['token-granted']);
    assert.deepEqual(byUser.get(fallback),['token-fallback']);
    assert.equal(byUser.has(revoked),false,
      'fallback must recheck canonical public consent');

    // Revoke after ID lookup but before the push-token SELECT.
    const revokedAtTokenRead = { async query(sql, params) {
      if (String(sql).includes('FROM public.users u') && String(sql).includes('fcm_tokens')) {
        await client.query('UPDATE public.user_consents SET political_opinions_consent=false WHERE user_id=$1', [granted]);
      }
      return pg.query(sql, params);
    } };
    rows = await loadCurrentSupporterTokens(revokedAtTokenRead, {
      subjectUserId: subject, kind: 'representative', level: 'CAMERA'
    });
    assert.deepEqual(rows.map(x => String(x.userId)), [fallback]);

    // Revoke after supporter ID lookup but before notification INSERT.
    await client.query('UPDATE public.user_consents SET political_opinions_consent=true WHERE user_id=$1', [granted]);
    await client.query('DELETE FROM political_selections WHERE user_id=$1', [fallback]);
    await client.query('DELETE FROM public.political_selections WHERE user_id=$1', [fallback]);
    const revokeAtInsert = { async query(sql, params) {
      if (String(sql).includes('INSERT INTO political_opinion_notifications')) {
        await client.query('UPDATE public.user_consents SET political_opinions_consent=false WHERE user_id=$1', [granted]);
      }
      return pg.query(sql, params);
    } };
    const result = await createSupporterOpinionNotifications(revokeAtInsert, {
      subjectUserId: subject,
      changes: [{ opinionId: '42', previousValue: 'f', newValue: 'c' }]
    });
    assert.equal(result.created, 0);
    assert.equal((await client.query(
      'SELECT count(*)::integer count FROM public.political_opinion_notifications'
    )).rows[0].count,0);
    // Restore the public consent and assert a successful event is written to
    // the canonical outbox, NOT the same-named temporary notification table.
    await client.query(
      'UPDATE public.user_consents SET political_opinions_consent=true WHERE user_id=$1',
      [granted]
    );
    const allowed=await createSupporterOpinionNotifications(pg,{
      subjectUserId:subject,
      changes:[{opinionId:'42',previousValue:'f',newValue:'c'}]
    });
    assert.equal(allowed.created,1);
    const publicNotice=await client.query(
      'SELECT recipient_user_id::text AS recipient,opinion_text ' +
      'FROM public.political_opinion_notifications WHERE subject_user_id=$1',[subject]
    );
    assert.deepEqual(publicNotice.rows,[{recipient:granted,opinion_text:'Synthetic opinion'}]);
    assert.equal((await client.query(
      'SELECT count(*)::integer count FROM pg_temp.political_opinion_notifications'
    )).rows[0].count,0,'shadow notification table must stay empty');

    // Missing canonical table must fall back to legacy user columns with the
    // identical active-consent filter, including the missing-override case.
    await client.query(
      'UPDATE public.user_consents SET political_opinions_consent=false WHERE user_id=$1',
      [granted]
    );
    // Do not drop the canonical table. A synthetic 42P01 adapter exercises
    // the documented missing-canonical-schema fallback without DDL damage.
    const noCanonical = { async query(sql, params) {
      if (String(sql).includes('FROM public.political_selections ps')) {
        const err = Error('synthetic canonical selection table unavailable');
        err.code = '42P01';
        throw err;
      }
      return pg.query(sql, params);
    } };
    supporters = await loadSupporterUserIds(noCanonical, opts);
    assert.equal(supporters.source, 'LEGACY');
    assert.deepEqual(supporters.userIds, [fallback]);
    assert.equal((await client.query('SHOW search_path')).rows[0].search_path,
      'pg_temp, public','fixture must exercise hostile shadow-first resolution');
    console.log('SUPPORTER_DELIVERY_PUBLIC_SCHEMA_SHADOW_PG17_PASS');
    console.log('SUPPORTER_NOTIFICATION_CONSENT_PG17_SYNTHETIC_PASS');
  } finally {
    if (client) {
      try { await client.query('ROLLBACK'); } finally { client.release(); }
    }
    await db.end();
  }
}
main().catch(e => {
  console.error('SUPPORTER_NOTIFICATION_CONSENT_SYNTHETIC_FAIL', e);
  process.exitCode = 1;
});
