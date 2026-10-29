'use strict';
// Execute only in GitHub's disposable postgres:17. No connection to Render or Supabase.
const assert=require('node:assert/strict');
const { Client }=require('pg');
const { seedE2EUser, E2E_USER_ID, E2E_ACTIVIST_USER_ID, E2E_ADMIN_USER_ID }=require('../scripts/stagingMigrate');

async function main() {
  if(process.env.GITHUB_ACTIONS!=='true' || process.env.PGHOST!=='localhost' ||
     process.env.PGPORT!=='5432' || process.env.PGUSER!=='postgres' ||
     process.env.PGDATABASE!=='postgres') throw Error('PostgreSQL17 GitHub Actions fixture only');
  const client=new Client();
  await client.connect();
  try {
    const meta=(await client.query("SELECT current_setting('server_version_num')::int AS v, current_database() AS db")).rows[0];
    assert.equal(Math.floor(meta.v/10000),17);
    assert.equal(meta.db,'postgres');
    await client.query(`
      CREATE TABLE public.users(
        id uuid PRIMARY KEY, name text, nome text, cognome text,
        ruolo varchar(3) NOT NULL DEFAULT 'E',
        status varchar(20) NOT NULL DEFAULT 'pending',
        account_type varchar(20) NOT NULL DEFAULT 'PERSON',
        is_admin boolean NOT NULL DEFAULT false,
        is_activist boolean NOT NULL DEFAULT false,
        paese_residenza text, regione_residenza text,
        provincia_residenza text, comune_residenza text,
        political_opinions_consent boolean NOT NULL DEFAULT false,
        political_opinions_consent_timestamp timestamptz,
        updated_at timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT users_account_type_check
          CHECK(account_type IN ('PERSON','ORGANIZATION','INSTITUTION'))
      );
      CREATE TABLE public.user_consents(
        user_id uuid PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
        privacy_policy_consent boolean,
        terms_of_service_consent boolean,
        consent_timestamp timestamptz,
        political_opinions_consent boolean,
        political_opinions_consent_timestamp timestamptz,
        updated_at timestamptz
      );
    `);
    const logger={log(){}};
    await seedE2EUser(client,logger);
    let people=(await client.query('SELECT id,account_type,ruolo,status,is_admin FROM public.users ORDER BY id')).rows;
    assert.equal(people.length,3);
    assert.ok(people.every(x=>x.account_type==='PERSON'&&x.status==='a'));
    assert.equal(people.find(x=>x.id===E2E_ADMIN_USER_ID).is_admin,true);
    assert.equal(people.find(x=>x.id===E2E_ACTIVIST_USER_ID).is_admin,false);
    assert.equal((await client.query('SELECT COUNT(*)::int n FROM public.user_consents')).rows[0].n,1);
    // Switch the disposable fixture to compact P/O/E, then run exactly the
    // SAME seeding code. This would fail if the old 'PERSON' literals remain.
    await client.query(`
      ALTER TABLE public.users DROP CONSTRAINT users_account_type_check;
      UPDATE public.users SET account_type='P' WHERE account_type='PERSON';
      ALTER TABLE public.users ADD CONSTRAINT users_account_type_check
        CHECK(account_type IN ('P','O','E'));
      ALTER TABLE public.users ALTER COLUMN account_type SET DEFAULT 'P';
    `);
    await seedE2EUser(client,logger);
    people=(await client.query('SELECT id,account_type,ruolo,status,is_admin FROM public.users ORDER BY id')).rows;
    assert.equal(people.length,3);
    assert.ok(people.every(x=>x.account_type==='P'&&x.status==='a'));
    assert.equal(people.find(x=>x.id===E2E_USER_ID).ruolo,'E');
    assert.equal(people.find(x=>x.id===E2E_ADMIN_USER_ID).ruolo,'AD');
    // Also verify the insert path against the compact default, not only UPSERT.
    await client.query('DELETE FROM public.users WHERE id=$1',[E2E_ACTIVIST_USER_ID]);
    await seedE2EUser(client,logger);
    assert.deepEqual((await client.query(
      'SELECT account_type,ruolo,is_activist FROM public.users WHERE id=$1',
      [E2E_ACTIVIST_USER_ID])).rows,[{account_type:'P',ruolo:'E',is_activist:true}]);
    assert.equal((await client.query('SELECT COUNT(*)::int n FROM public.user_consents')).rows[0].n,1);
    console.log('STAGING_E2E_SEED_REAL_PG17_PASS',JSON.stringify({
      modes:['PERSON','P'],upsert:true,compactInsert:true,users:3,productionConnected:false
    }));
  }finally{await client.end()}
}
main().catch(err=>{console.error(err);process.exitCode=1});
