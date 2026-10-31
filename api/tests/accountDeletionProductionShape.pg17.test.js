const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const Erasure = require('../services/privacyErasureLedgerService');

// Synthetic only: accepts the disposable localhost PG17 CI database and nothing else.
// FK rules/UUID types are modeled on read-only production metadata (2026-10-28).
const url = process.env.TEST_DATABASE_URL || '';
const allowed = /^postgres(?:ql)?:\/\/[^@\s]+@(?:localhost|127\.0\.0\.1):5432\/privacy_synthetic(?:\?.*)?$/.test(url);
if (!allowed) {
  test('production-shaped deletion requires an isolated localhost database',
    { skip: 'Only the disposable localhost privacy_synthetic database is allowed' }, () => {});
} else {
  const pool = new Pool({ connectionString:url, max:2 });
  const mine='11111111-1111-4111-8111-111111111111';
  const other='22222222-2222-4222-8222-222222222222';
  async function setup() {
    await pool.query('DROP SCHEMA IF EXISTS public CASCADE');
    await pool.query('CREATE SCHEMA public');
    await pool.query('CREATE TABLE users(id uuid PRIMARY KEY)');
    const ddl=[
      'CREATE TABLE opinioni_risposte(user_id uuid PRIMARY KEY, answer text)',
      'CREATE TABLE user_rights_requests(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, request_type text NOT NULL)',
      'CREATE TABLE active_sessions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id varchar NOT NULL, refresh_token_hash text)',
      'CREATE TABLE identity_verifications(user_id uuid UNIQUE, person_key text UNIQUE NOT NULL)',
      'CREATE TABLE eventi(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), creator_user_id uuid NULL, approved_by_user_id uuid NULL, election_lifecycle_closed_by_user_id uuid NULL)',
      'CREATE TABLE candidati(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION, evento_id uuid REFERENCES eventi(id))',
      'CREATE TABLE political_candidacies(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE)',
      'CREATE TABLE political_programs(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, candidacy_id uuid NOT NULL REFERENCES political_candidacies(id) ON DELETE CASCADE)',
      'CREATE TABLE political_mandates(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE)',
      'CREATE TABLE mandate_program_snapshots(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, mandate_id uuid NOT NULL REFERENCES political_mandates(id) ON DELETE CASCADE)',
      'CREATE TABLE referendum_abrogativi(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), userid uuid NULL)',
      'CREATE TABLE iniziative_popolari(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), userid uuid NULL)',
      'CREATE TABLE notifiche_demos(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), id_utente uuid NOT NULL REFERENCES users(id) ON DELETE NO ACTION)'
    ];
    for (const statement of ddl) await pool.query(statement);
    await pool.query('INSERT INTO users(id) VALUES ($1),($2)',[mine,other]);
    for(const uid of [mine,other]){
      await pool.query('INSERT INTO opinioni_risposte(user_id,answer) VALUES($1,$2)',[uid,'synthetic']);
      await pool.query('INSERT INTO user_rights_requests(user_id,request_type) VALUES($1,$2)',[uid,'data_export']);
      await pool.query('INSERT INTO active_sessions(user_id,refresh_token_hash) VALUES($1,$2)',[uid,'synthetic']);
      await pool.query('INSERT INTO identity_verifications(user_id,person_key) VALUES($1,$2)',[uid,'synthetic-'+uid]);
      const e=(await pool.query('INSERT INTO eventi(creator_user_id,approved_by_user_id,election_lifecycle_closed_by_user_id) VALUES($1,$1,$1) RETURNING id',[uid])).rows[0].id;
      await pool.query('INSERT INTO candidati(user_id,evento_id) VALUES($1,$2)',[uid,e]);
      const c=(await pool.query('INSERT INTO political_candidacies(user_id) VALUES($1) RETURNING id',[uid])).rows[0].id;
      await pool.query('INSERT INTO political_programs(user_id,candidacy_id) VALUES($1,$2)',[uid,c]);
      const m=(await pool.query('INSERT INTO political_mandates(user_id) VALUES($1) RETURNING id',[uid])).rows[0].id;
      await pool.query('INSERT INTO mandate_program_snapshots(user_id,mandate_id) VALUES($1,$2)',[uid,m]);
      await pool.query('INSERT INTO referendum_abrogativi(userid) VALUES($1)',[uid]);
      await pool.query('INSERT INTO iniziative_popolari(userid) VALUES($1)',[uid]);
      await pool.query('INSERT INTO notifiche_demos(id_utente) VALUES($1)',[uid]);
    }
  }
  test('UUID and production FK erasure, unrelated-account preservation and idempotency', async () => {
    await setup();
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      assert.equal((await Erasure.enforceAccountDeletion(client,mine)).userDeleted,1);
      assert.equal((await Erasure.enforceAccountDeletion(client,mine)).userDeleted,0);
      await client.query('COMMIT');
    }catch(error){await client.query('ROLLBACK');throw error;}
    finally{client.release();}
    const removed=[
      ['users','id'],['opinioni_risposte','user_id'],
      ['user_rights_requests','user_id'],['active_sessions','user_id'],
      ['identity_verifications','user_id'],['candidati','user_id'],
      ['political_candidacies','user_id'],['political_programs','user_id'],
      ['political_mandates','user_id'],['mandate_program_snapshots','user_id'],
      ['notifiche_demos','id_utente']
    ];
    for (const [table,column] of removed) {
      const q='SELECT count(*) FILTER (WHERE "'+column+'"::text=$1)::int AS removed, count(*) FILTER (WHERE "'+column+'"::text=$2)::int AS other FROM "'+table+'"';
      assert.deepEqual((await pool.query(q,[mine,other])).rows[0],{removed:0,other:1},table);
    }
    const publicRows=[['eventi','creator_user_id'],['eventi','approved_by_user_id'],
      ['eventi','election_lifecycle_closed_by_user_id'],
      ['referendum_abrogativi','userid'],['iniziative_popolari','userid']];
    for(const [table,column] of publicRows) {
      const q='SELECT count(*)::int AS total, count(*) FILTER (WHERE "'+column+'" IS NULL)::int AS unlinked, count(*) FILTER (WHERE "'+column+'"=$1)::int AS other FROM "'+table+'"';
      assert.deepEqual((await pool.query(q,[other])).rows[0],{total:2,unlinked:1,other:1},table+'.'+column);
    }
  });
  test.after(async()=>{await pool.query('DROP SCHEMA IF EXISTS public CASCADE');await pool.query('CREATE SCHEMA public');await pool.end()});
}
