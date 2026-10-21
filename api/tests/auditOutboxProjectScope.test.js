'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { assertOutboxProjectScope, parseDatabaseLocation } =
  require('../services/auditOutboxProjectScope');

const staging = 'fkeayjzvtuvzesljhjbc';
const production = 'wxnblcqoyjqxktwkcqok';
const direct = (ref, role) =>
  `postgresql://${role}:synthetic-only@db.${ref}.supabase.co:5432/postgres`;
const pooler = (ref, role) =>
  `postgresql://${role}.${ref}:synthetic-only@aws-1-eu-central-1.pooler.supabase.com:5432/postgres`;

test('production scope accepts only the fixed production project for both pools', () => {
  assert.equal(assertOutboxProjectScope({
    mainUrl: direct(production, 'postgres'),
    outboxUrl: pooler(production, 'demos_outbox_runtime'),
    deploymentScope: 'production'
  }), 'production');
});

test('staging accepts main pooler and dedicated session/direct, but never production', () => {
  assert.equal(assertOutboxProjectScope({
    mainUrl: pooler(staging, 'postgres'),
    outboxUrl: direct(staging, 'demos_outbox_runtime'),
    deploymentScope: 'staging'
  }), 'staging');
  assert.throws(() => assertOutboxProjectScope({
    mainUrl: pooler(staging, 'postgres'),
    outboxUrl: pooler(production, 'demos_outbox_runtime'),
    deploymentScope: 'staging'
  }), /PROJECT_SCOPE_REJECTED/);
  assert.throws(() => assertOutboxProjectScope({
    mainUrl: direct(production, 'postgres'),
    outboxUrl: pooler(staging, 'demos_outbox_runtime'),
    deploymentScope: 'production'
  }), /PROJECT_SCOPE_REJECTED/);
});

test('explicit deployment scope must match the pinned project and cannot be omitted', () => {
  const args = {
    mainUrl: direct(staging, 'postgres'),
    outboxUrl: direct(staging, 'demos_outbox_runtime')
  };
  for (const deploymentScope of [undefined, '', 'production', 'unexpected']) {
    assert.throws(() => assertOutboxProjectScope({ ...args, deploymentScope }),
      /PROJECT_SCOPE_REJECTED/);
  }
  assert.equal(assertOutboxProjectScope({ ...args, deploymentScope: 'staging' }), 'staging');
});

test('rejects admin roles, unrecognized project refs, extra ports and forged hostname', () => {
  const base = { mainUrl: pooler(production, 'postgres'), deploymentScope: 'production' };
  const bad = [
    pooler(production, 'postgres'),
    pooler('aaaaaaaaaaaaaaaaaaaa', 'demos_outbox_runtime'),
    direct(production, 'postgres'),
    direct(production, 'demos_outbox_runtime').replace(':5432/', ':6543/'),
    pooler(production, 'demos_outbox_runtime').replace('.supabase.com', '.supabase.com.bad.test'),
    pooler(production, 'demos_outbox_runtime').replace('/postgres', '/other'),
    pooler(production, 'demos_outbox_runtime').replace('demos_outbox_runtime.', 'fakeuser.'),
    'postgresql://user:pass@127.0.0.1:5432/demos_outbox_ci'
  ];
  for (const outboxUrl of bad) {
    assert.throws(() => assertOutboxProjectScope({ ...base, outboxUrl }),
      /PROJECT_SCOPE_REJECTED/);
  }
});

test('ephemeral PostgreSQL CI is accepted only with both local URLs', () => {
  const mainUrl = 'postgresql://main:example@127.0.0.1:5432/demos_outbox_ci';
  const outboxUrl = 'postgresql://worker:example@127.0.0.1:5432/demos_outbox_ci';
  assert.equal(assertOutboxProjectScope({ mainUrl, outboxUrl,
    deploymentScope: 'ci-only', nodeEnv: 'test' }), 'ci-only');
  assert.throws(() => assertOutboxProjectScope({
    mainUrl, outboxUrl, deploymentScope: 'production', nodeEnv: 'test'
  }), /PROJECT_SCOPE_REJECTED/);
  assert.deepEqual(parseDatabaseLocation(outboxUrl),
    { project: 'ci-only', kind: 'local-ci', role: 'worker' });
});
