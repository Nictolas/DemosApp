'use strict';

/**
 * SYNTHETIC RLS EXPERIMENT — do not import in DEMOS runtime or point at Supabase.
 * All DDL and writable SQL are restricted to disposable PostgreSQL 17 on
 * GitHub Actions. This verifies PostgreSQL role boundaries in a toy schema,
 * NOT the actual Supabase auth.uid(), JWT, RLS policies or end-user API.
 */
const assert = require('node:assert/strict');
const {Client} = require('pg');
const {createCatalogRegistry,encodeEnvelope,decodeEnvelope} =
  require('../utils/opinionCodecEnvelope');
const {restoreCatalogRegistry} = require('../utils/opinionCatalogManifest');

const DB='opinion_bitset_ci';
const HOST='127.0.0.1';
const SCHEMA='ci_opinion_rls_247';
const CATALOG=SCHEMA+'.catalog_versions';
const VOTES=SCHEMA+'.votes';
const A='ci_opinion_rls_account_a';
const B='ci_opinion_rls_account_b';
const PASSWORD_A='synthetic-rls-only-a';
const PASSWORD_B='synthetic-rls-only-b';

function assertEphemeral() {
  if(process.env.GITHUB_ACTIONS!=='true' ||
     process.env.OPINION_BENCH_EPHEMERAL!=='yes' ||
     process.env.PGHOST!==HOST ||
     process.env.PGPORT!=='5432' ||
     process.env.PGDATABASE!==DB ||
     process.env.PGUSER!=='postgres' ||
     process.env.PGPASSWORD!=='synthetic-only') {
    throw new Error('RLS probe refuses anything but disposable GitHub Actions PostgreSQL');
  }
}
async function connect(user,password) {
  const client=new Client({host:HOST,port:5432,database:DB,user,password,
    application_name:'ci_opinion_rls_synthetic_only',statement_timeout:10000});
  await client.connect();
  const check=await client.query('SELECT current_database() AS db, current_user::text AS who');
  assert.equal(check.rows[0].db,DB);
  assert.equal(check.rows[0].who,user);
  return client;
}
function persistedEnvelope(row) {
  return {schemaVersion:1,catalogVersion:row.catalog_version,
    catalogFingerprint:row.catalog_fingerprint,encoding:row.encoding,
    payload:row.payload};
}
async function createIsolatedFixture(admin) {
  // These login roles and their passwords exist ONLY inside this discarded
  // container. SQL strings below contain only hard-coded synthetic identifiers.
  await admin.query("CREATE ROLE "+A+
    " LOGIN PASSWORD '"+PASSWORD_A+"' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS");
  await admin.query("CREATE ROLE "+B+
    " LOGIN PASSWORD '"+PASSWORD_B+"' NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS");
  await admin.query('CREATE SCHEMA '+SCHEMA);
  await admin.query('CREATE TABLE '+CATALOG+' ('+
    'version integer PRIMARY KEY, ordered_ids jsonb NOT NULL, fingerprint text NOT NULL)');
  await admin.query('CREATE TABLE '+VOTES+' ('+
    'vote_id text PRIMARY KEY, subject_role name NOT NULL, '+
    'catalog_version integer NOT NULL REFERENCES '+CATALOG+'(version), '+
    'encoding text NOT NULL, catalog_fingerprint text NOT NULL, payload bytea NOT NULL)');
  await admin.query('REVOKE ALL ON SCHEMA '+SCHEMA+' FROM PUBLIC');
  await admin.query('REVOKE ALL ON '+CATALOG+', '+VOTES+' FROM PUBLIC');
  await admin.query('GRANT CONNECT ON DATABASE '+DB+' TO '+A+', '+B);
  await admin.query('GRANT USAGE ON SCHEMA '+SCHEMA+' TO '+A+', '+B);
  await admin.query('GRANT SELECT ON '+CATALOG+' TO '+A+', '+B);
  await admin.query('GRANT SELECT,INSERT,UPDATE,DELETE ON '+VOTES+' TO '+A+', '+B);
  await admin.query('ALTER TABLE '+VOTES+' ENABLE ROW LEVEL SECURITY');
  await admin.query('ALTER TABLE '+VOTES+' FORCE ROW LEVEL SECURITY');
  await admin.query('CREATE POLICY synthetic_own_votes ON '+VOTES+
    ' FOR ALL TO '+A+', '+B+
    ' USING (subject_role = current_user) WITH CHECK (subject_role = current_user)');
  const registry=createCatalogRegistry([{version:1,ids:[
    'synthetic_alpha','synthetic_beta','synthetic_gamma'
  ]}]);
  const catalog=registry.get(1);
  await admin.query('INSERT INTO '+CATALOG+
    ' (version,ordered_ids,fingerprint) VALUES ($1,$2::jsonb,$3)',
    [1,JSON.stringify(catalog.ids),catalog.fingerprint]);
  const envelopeA=encodeEnvelope(registry,{version:1,encoding:'fixed',
    answers:{synthetic_alpha:'f',synthetic_beta:'c'}});
  const envelopeB=encodeEnvelope(registry,{version:1,encoding:'sparse',
    answers:{synthetic_alpha:'i',synthetic_gamma:'f'}});
  for (const [voteId,role,envelope] of [
    ['synthetic_vote_a',A,envelopeA],['synthetic_vote_b',B,envelopeB]
  ]) {
    await admin.query('INSERT INTO '+VOTES+
      ' (vote_id,subject_role,catalog_version,encoding,catalog_fingerprint,payload)'+
      ' VALUES ($1,$2,$3,$4,$5,$6)',[
        voteId,role,envelope.catalogVersion,envelope.encoding,
        envelope.catalogFingerprint,envelope.payload
      ]);
  }
  return registry;
}
async function catalogFor(account) {
  const found=await account.query('SELECT version,ordered_ids,fingerprint FROM '+
    CATALOG+' ORDER BY version ASC');
  return restoreCatalogRegistry(JSON.stringify({schemaVersion:1,
    catalogs:found.rows.map(r=>({
      version:r.version,ids:r.ordered_ids,fingerprint:r.fingerprint
    }))}));
}
async function expectDenied(call,label) {
  await assert.rejects(call,err=>{
    assert.equal(err.code,'42501',label+': expected insufficient_privilege/RLS error');
    return true;
  },label);
}
async function checkRole(account,expectedRole,expectedVote,expectedAnswer) {
  const identity=await account.query("SELECT current_user::text AS who, "+
    "row_security_active('"+VOTES+"'::regclass) AS enforced");
  assert.equal(identity.rows[0].who,expectedRole);
  assert.equal(identity.rows[0].enforced,true);
  const role=await account.query(
    'SELECT rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user');
  assert.deepEqual(role.rows,[{rolsuper:false,rolbypassrls:false}]);
  const registry=await catalogFor(account); // both may read version metadata
  const all=await account.query('SELECT vote_id,subject_role,catalog_version,'+
    'encoding,catalog_fingerprint,payload FROM '+VOTES+' ORDER BY vote_id');
  assert.equal(all.rowCount,1,expectedRole+' must read only own vote');
  assert.equal(all.rows[0].vote_id,expectedVote);
  assert.equal(all.rows[0].subject_role,expectedRole);
  assert.deepEqual(decodeEnvelope(registry,persistedEnvelope(all.rows[0])),
    expectedAnswer);
}
async function main() {
  assertEphemeral();
  let admin,accountA,accountB;
  try {
    admin=await connect('postgres','synthetic-only');
    const registry=await createIsolatedFixture(admin);
    accountA=await connect(A,PASSWORD_A);
    accountB=await connect(B,PASSWORD_B);
    const answerA={synthetic_alpha:'f',synthetic_beta:'c',synthetic_gamma:null};
    const answerB={synthetic_alpha:'i',synthetic_beta:null,synthetic_gamma:'f'};
    await checkRole(accountA,A,'synthetic_vote_a',answerA);
    await checkRole(accountB,B,'synthetic_vote_b',answerB);
    assert.equal((await accountA.query('SELECT vote_id FROM '+VOTES+
      ' WHERE vote_id=$1',['synthetic_vote_b'])).rowCount,0);
    assert.equal((await accountB.query('SELECT vote_id FROM '+VOTES+
      ' WHERE vote_id=$1',['synthetic_vote_a'])).rowCount,0);

    // Row-level visibility applies to writes as well as SELECT, including
    // identity changes and blind UPDATE/DELETE attempts on someone else's ID.
    assert.equal((await accountA.query('UPDATE '+VOTES+
      ' SET encoding=$1 WHERE vote_id=$2 RETURNING vote_id',
      ['fixed','synthetic_vote_b'])).rowCount,0);
    assert.equal((await accountA.query('DELETE FROM '+VOTES+
      ' WHERE vote_id=$1 RETURNING vote_id',['synthetic_vote_b'])).rowCount,0);
    await expectDenied(accountA.query('UPDATE '+VOTES+
      ' SET subject_role=$1 WHERE vote_id=$2',[B,'synthetic_vote_a']),
      'changing an existing vote owner must fail');
    const ownVote=encodeEnvelope(registry,{version:1,encoding:'trimmed',
      answers:{synthetic_alpha:'f'}});
    await expectDenied(accountA.query('INSERT INTO '+VOTES+
      ' (vote_id,subject_role,catalog_version,encoding,catalog_fingerprint,payload)'+
      ' VALUES ($1,$2,$3,$4,$5,$6)',[
        'synthetic_spoof_b',B,1,ownVote.encoding,
        ownVote.catalogFingerprint,ownVote.payload
      ]),'inserting for another account must fail');
    await expectDenied(accountA.query('UPDATE '+CATALOG+
      ' SET fingerprint=$1 WHERE version=1',['0'.repeat(64)]),
      'regular user must not change global slot mapping');
    await expectDenied(accountA.query('INSERT INTO '+CATALOG+
      ' (version,ordered_ids,fingerprint) VALUES (2,$1::jsonb,$2)',[
        JSON.stringify(['synthetic_alpha']),'0'.repeat(64)
      ]),'regular user must not append global catalog');
    await expectDenied(accountA.query('SET ROLE '+B),
      'ordinary account may not assume another account role');

    // Turning row_security off is not a privilege escalation for restricted
    // database login roles: PostgreSQL rejects protected queries.
    await accountA.query('SET row_security=off');
    await expectDenied(accountA.query('SELECT COUNT(*) FROM '+VOTES),
      'turning off RLS should fail closed');
    await accountA.query('RESET row_security');

    const created=await accountA.query('INSERT INTO '+VOTES+
      ' (vote_id,subject_role,catalog_version,encoding,catalog_fingerprint,payload)'+
      ' VALUES ($1,$2,$3,$4,$5,$6) RETURNING vote_id',[
        'synthetic_vote_a2',A,1,ownVote.encoding,ownVote.catalogFingerprint,ownVote.payload
      ]);
    assert.equal(created.rowCount,1);
    const changed=await accountA.query('UPDATE '+VOTES+
      ' SET encoding=$1,payload=$2 WHERE vote_id=$3 RETURNING vote_id',[
        ownVote.encoding,ownVote.payload,'synthetic_vote_a'
      ]);
    assert.equal(changed.rowCount,1);
    assert.equal((await accountA.query('DELETE FROM '+VOTES+
      ' WHERE vote_id=$1 RETURNING vote_id',['synthetic_vote_a2'])).rowCount,1);
    assert.equal((await accountB.query('SELECT vote_id FROM '+VOTES)).rowCount,1);
    await checkRole(accountB,B,'synthetic_vote_b',answerB);
    assert.equal((await admin.query('SELECT COUNT(*)::int AS n FROM '+VOTES))
      .rows[0].n,2);

    console.log('OPINION_RLS_SYNTHETIC_PASS');
    console.log('OPINION_RLS_RESULT_JSON='+JSON.stringify({
      postgres:17,roles:[A,B],roleLoginIsolation:true,
      forcedRls:true,ownVotesReadable:true,crossAccountReadHidden:true,
      crossAccountUpdateDeleteHidden:true,crossAccountInsertRejected:true,
      ownerChangeRejected:true,roleImpersonationRejected:true,
      rowSecurityOffRejected:true,catalogReadOnlyToAccounts:true,
      ownVoteWritesAllowed:true,codecLegacyValuesPreserved:true,
      productionSupabaseRlsTested:false,
      warning:'Synthetic PostgreSQL policy only; not auth.uid/JWT or real DEMOS policies'
    }));
  } finally {
    for(const client of [accountB,accountA,admin]) {
      if(client) await client.end();
    }
  }
}

main().catch(error=>{
  console.error('Synthetic RLS probe FAILED:',error);
  process.exitCode=1;
});
