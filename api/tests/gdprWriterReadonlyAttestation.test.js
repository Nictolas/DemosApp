'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertStagingTarget, publicReport, SQL } =
  require('../scripts/attest-gdpr-writer-readonly');

const REF = 'fkeayjzvtuvzesljhjbc';
const MARKER = 'demos-staging-readonly-20261027';
const env = (url, marker = MARKER) => ({
  DATABASE_URL: url, GDPR_WRITER_ATTESTATION: marker,
});

test('only the explicit Demos-Staging Supabase direct target is accepted', () => {
  assert.deepEqual(assertStagingTarget(env(
    `postgresql://staging_writer:SECRET@db.${REF}.supabase.co:5432/postgres?sslmode=require`
  )), { project: 'Demos-Staging', target_checked: true });
});

test('staging Supavisor pooler role is accepted, production Supavisor is refused', () => {
  assert.equal(assertStagingTarget(env(
    `postgresql://postgres.${REF}:SECRET@aws-0-eu-central-1.pooler.supabase.com:6543/postgres?sslmode=require`
  )).target_checked, true);
  assert.throws(() => assertStagingTarget(env(
    'postgresql://postgres.wxnblcqoyjqxktwkcqok:SECRET@aws-0-eu-central-1.pooler.supabase.com:6543/postgres'
  )), /INVALID_TARGET/);
});

test('refuses production direct target, arbitrary endpoint, incorrect database and missing operator marker', () => {
  const rejected = [
    'postgresql://postgres:SECRET@db.wxnblcqoyjqxktwkcqok.supabase.co/postgres',
    'postgresql://postgres:SECRET@localhost:5432/postgres',
    `postgresql://postgres:SECRET@db.${REF}.supabase.co/private_db`,
    `postgresql://postgres.${REF}:SECRET@fakepooler.example.org:6543/postgres`,
    `https://postgres.${REF}:SECRET@aws-0.pooler.supabase.com/postgres`,
  ];
  for (const url of rejected) assert.throws(() => assertStagingTarget(env(url)), /INVALID_TARGET/);
  assert.throws(() => assertStagingTarget(env(
    `postgresql://postgres:SECRET@db.${REF}.supabase.co/postgres`, ''
  )), /NOT_ENABLED/);
  assert.throws(() => assertStagingTarget(env(undefined)), /INVALID_TARGET/);
});

test('writer probe URL guard rejects wrong ports, region, overrides and downgraded TLS', () => {
  const base = `postgresql://demos_staging_runtime.${REF}:not-a-real-password@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require`;
  const direct = `postgresql://demos_staging_runtime:not-a-real-password@db.${REF}.supabase.co:5432/postgres?sslmode=require`;
  assert.equal(assertStagingTarget(env(base)).target_checked,true);
  assert.equal(assertStagingTarget(env(direct)).target_checked,true);
  for (const bad of [
    base.replace('?sslmode=require',''),
    base.replace('sslmode=require','sslmode=disable'),
    base.replace('sslmode=require','sslmode=prefer'),
    base.replace(':5432/',':9999/'),
    base.replace('eu-central-1','us-east-1'),
    base.replace('.pooler.supabase.com','.pooler.attacker.invalid'),
    base + '&sslmode=require',
    base + '&options=-csearch_path%3Dpublic',
    direct + '&pgbouncer=true',
    direct.replace(':5432/',':443/'),
    direct.replace('demos_staging_runtime:','demos_staging_runtime@'),
    base + '#fragment'
  ]) {
    assert.throws(() => assertStagingTarget(env(bad)), /INVALID_TARGET/,
      'unexpected target must fail closed');
  }
});

test('empty catalog is always NO-GO, not interpreted as missing user data', () => {
  const report = publicReport([]);
  assert.equal(report.status, 'NO_GO_MISSING_LEDGER');
  assert.equal(report.sql_writer_attested, false);
  assert.equal(report.live_render_pool_verified, false);
});

test('missing ledger still reports independent SQL session identity without false readiness', () => {
  const report = publicReport([{
    current_role: 'synthetic_staging_writer', session_role: 'synthetic_staging_writer',
    role_setting: 'none', database_name: 'postgres', ledger_present: false,
    ledger_rls: null, ledger_insert_grant: null, ledger_select_grant: null
  }]);
  assert.equal(report.current_role, 'synthetic_staging_writer');
  assert.equal(report.session_role, 'synthetic_staging_writer');
  assert.equal(report.sql_writer_attested, true);
  assert.equal(report.ledger_present, false);
  assert.equal(report.catalog_eligibility, 'NOT_ATTESTED');
  assert.equal(report.status, 'NO_GO_MISSING_LEDGER');
  assert.equal(report.live_render_pool_verified, false);
});

test('existing ledger emits only a cautious, redacted readonly identity report', () => {
  const report = publicReport([{
    current_role: 'synthetic_writer', session_role: 'synthetic_writer',
    role_setting: 'none', database_name: 'postgres', ledger_present: true, ledger_rls: true,
    ledger_force_rls: false, ledger_owner: true,
    ledger_insert_grant: true, ledger_select_grant: true, bypass_rls: false,
    public_grants_exist: false, public_column_grants_exist: false,
    api_roles_with_dml_grants: 0
  }]);
  assert.equal(report.sql_writer_attested, true);
  assert.equal(report.catalog_eligibility, 'POSSIBLE_NOT_PROVEN');
  assert.equal(report.ledger_acl_protected, true);
  assert.equal(report.status, 'READONLY_IDENTITY_ONLY_NOT_RELEASE_GO');
  assert.equal(report.live_render_pool_verified, false);
  assert.doesNotMatch(JSON.stringify(report), /SECRET|DATABASE_URL|5432|6543|supabase.co/);
});

test('non-owner without bypass never obtains a positive catalog eligibility claim', () => {
  const result = publicReport([{
    current_role: 'limited_writer', session_role: 'limited_writer',
    database_name: 'postgres', ledger_present: true, ledger_rls: true, ledger_force_rls: false,
    ledger_owner: false, ledger_insert_grant: true,
    ledger_select_grant: true, bypass_rls: false,
    public_grants_exist: false, public_column_grants_exist: false,
    api_roles_with_dml_grants: 0
  }]);
  assert.equal(result.catalog_eligibility, 'NOT_ATTESTED');
  assert.equal(result.status, 'READONLY_IDENTITY_ONLY_NOT_RELEASE_GO');
});

test('FORCE RLS blocks owner-only catalog eligibility but not BYPASSRLS', () => {
  const base = {
    current_role: 'synthetic_writer', session_role: 'synthetic_writer',
    role_setting: 'none', database_name: 'postgres',
    ledger_present: true, ledger_rls: true, ledger_force_rls: true,
    ledger_owner: true, ledger_insert_grant: true,
    ledger_select_grant: true, bypass_rls: false,
    public_grants_exist: false, public_column_grants_exist: false,
    api_roles_with_dml_grants: 0
  };
  // A table owner with FORCE RLS is subject to policies. No policy is
  // proven by this catalog-only probe: never suggest possible writer access.
  const owner = publicReport([base]);
  assert.equal(owner.catalog_eligibility, 'NOT_ATTESTED');
  assert.equal(owner.status, 'READONLY_IDENTITY_ONLY_NOT_RELEASE_GO');
  assert.equal(owner.live_render_pool_verified, false);

  // PostgreSQL BYPASSRLS bypasses row security even when FORCE is set.
  // This remains only a catalog possibility, NEVER a runtime/Render proof.
  for (const state of [
    {...base, ledger_owner: false, bypass_rls: true},
    {...base, ledger_owner: true, bypass_rls: true}
  ]) {
    const bypass = publicReport([state]);
    assert.equal(bypass.catalog_eligibility, 'POSSIBLE_NOT_PROVEN');
    assert.equal(bypass.live_render_pool_verified, false);
  }
  assert.equal(publicReport([{...base, ledger_force_rls: false}])
    .catalog_eligibility, 'POSSIBLE_NOT_PROVEN');
});

test('RLS alone is insufficient when PUBLIC or Supabase API roles still have privileges', () => {
  const base = {
    current_role: 'synthetic_writer', session_role: 'synthetic_writer',
    role_setting: 'none', database_name: 'postgres', ledger_present: true, ledger_rls: true,
    ledger_force_rls: false, ledger_owner: true, bypass_rls: false,
    ledger_insert_grant: true, ledger_select_grant: true,
    public_grants_exist: false, public_column_grants_exist: false,
    api_roles_with_dml_grants: 0
  };
  for (const extra of [
    { public_grants_exist: true },
    { public_column_grants_exist: true },
    { api_roles_with_dml_grants: 1 },
    { public_grants_exist: undefined },
    { api_roles_with_dml_grants: undefined },
    { ledger_rls: false }
  ]) {
    const report = publicReport([{ ...base, ...extra }]);
    assert.equal(report.ledger_acl_protected, false);
    assert.equal(report.catalog_eligibility, 'NOT_ATTESTED');
    assert.equal(report.status, 'NO_GO_LEDGER_SCHEMA_NOT_PROTECTED');
    assert.equal(report.live_render_pool_verified, false);
  }
});

test('probe query never reads ledger rows or performs DML/DDL', () => {
  assert.match(SQL, /aclexplode/);
  assert.match(SQL, /api_roles_with_dml_grants/);
  assert.match(SQL, /FROM pg_catalog\.pg_class/);
  assert.match(SQL, /LEFT JOIN/);
  assert.doesNotMatch(SQL, /FROM public\.privacy_erasure_ledger/);
  assert.doesNotMatch(SQL, /^\s*(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|TRUNCATE|GRANT|REVOKE)\b/gmi);
});
