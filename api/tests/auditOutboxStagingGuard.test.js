'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  STAGING_PROJECT_REF, validateStagingOutboxTarget, runStagingOutboxPreflight
} = require('../services/auditOutboxStagingGuard');

const password = 'unit-test-only';
const direct = `postgresql://demos_outbox_runtime:${password}@db.${STAGING_PROJECT_REF}.supabase.co:5432/postgres`;
const pooler = `postgresql://demos_outbox_runtime.${STAGING_PROJECT_REF}:${password}@aws-0-eu-central-1.pooler.supabase.com:5432/postgres`;

test('accepts only the fixed staging project direct or shared session connection', () => {
  assert.deepEqual(validateStagingOutboxTarget(direct),
    { stagingRef: STAGING_PROJECT_REF, mode: 'direct' });
  assert.deepEqual(validateStagingOutboxTarget(pooler),
    { stagingRef: STAGING_PROJECT_REF, mode: 'session-pooler' });
});

test('rejects production, generic hosts, postgres admin, wrong database and transaction pooler', () => {
  for (const url of [
    direct.replace(STAGING_PROJECT_REF, 'wxnblcqoyjqxktwkcqok'),
    pooler.replace(STAGING_PROJECT_REF, 'wxnblcqoyjqxktwkcqok'),
    direct.replace('demos_outbox_runtime', 'postgres'),
    direct.replace('/postgres', '/demos_production'),
    pooler.replace(':5432/', ':6543/'),
    direct.replace(':5432/', ':5434/'),
    direct.replace('.supabase.co', '.supabase.co.example.net'),
    pooler.replace('aws-0-eu-central-1.pooler.supabase.com', 'attacker.pooler.supabase.com'),
    'https://fkeayjzvtuvzesljhjbc.supabase.co/rest/v1',
    '',
    undefined
  ]) {
    assert.throws(() => validateStagingOutboxTarget(url),
      /AUDIT_STAGING_TARGET_REJECTED/);
  }
});

test('readonly staging preflight calls membership validator and checks database name', async () => {
  const actions = [];
  const result = await runStagingOutboxPreflight({
    env: { AUDIT_OUTBOX_DATABASE_URL: pooler },
    open: () => ({
      ensureReady: async () => { actions.push('authorized'); },
      pool: {
        query: async sql => {
          assert.equal(sql, 'SELECT current_database() AS name');
          actions.push('select-database-only');
          return { rows: [{ name: 'postgres' }] };
        },
        end: async () => { actions.push('disconnect'); }
      }
    })
  });
  assert.deepEqual(actions, ['authorized', 'select-database-only', 'disconnect']);
  assert.deepEqual(result, {
    stagingRef: STAGING_PROJECT_REF, roleAuthorized: true, readOnly: true
  });
  assert.ok(!JSON.stringify(result).includes(password));
});

test('denied role or wrong database closes connection and fails', async () => {
  for (const failsOf of ['role', 'database']) {
    let disconnected = false;
    const run = () => runStagingOutboxPreflight({
      env: { AUDIT_OUTBOX_DATABASE_URL: direct },
      open: () => ({
        ensureReady: async () => {
          if (failsOf === 'role') throw new Error('PRIVATE_CREDENTIAL_MESSAGE');
        },
        pool: {
          query: async () => ({ rows: [{ name: 'demOS' }] }),
          end: async () => { disconnected = true; }
        }
      })
    });
    await assert.rejects(run);
    assert.equal(disconnected, true);
  }
});

test('malformed or production URL is rejected before opening any connection', async () => {
  let opened = 0;
  await assert.rejects(() => runStagingOutboxPreflight({
    env: {
      AUDIT_OUTBOX_DATABASE_URL: 'postgresql://postgres:fake@db.wxnblcqoyjqxktwkcqok.supabase.co:5432/postgres'
    },
    open: () => { opened++; throw new Error('should never be called'); }
  }), /AUDIT_STAGING_TARGET_REJECTED/);
  assert.equal(opened, 0);
});


test('Axiom staging guard prevents accidental writes to production datasets', () => {
  const { STAGING_AXIOM_DATASET, assertOutboxAxiomTarget } =
    require('../services/auditOutboxAxiomTarget');
  assert.equal(STAGING_AXIOM_DATASET, 'demos-security-staging');
  assert.equal(assertOutboxAxiomTarget(STAGING_AXIOM_DATASET, 'staging'), STAGING_AXIOM_DATASET);
  for (const target of ['real-time', 'centralized_logs', '', undefined, 'unknown-staging']) {
    assert.throws(() => assertOutboxAxiomTarget(target, 'staging'),
      error => error.message === 'OUTBOX_AXIOM_DATASET_SCOPE_REJECTED');
  }
  for (const target of [STAGING_AXIOM_DATASET, 'some-other-staging']) {
    assert.throws(() => assertOutboxAxiomTarget(target, 'production'),
      error => error.message === 'OUTBOX_AXIOM_DATASET_SCOPE_REJECTED');
  }
  assert.equal(assertOutboxAxiomTarget('real-time', 'production'), 'real-time');
  assert.equal(assertOutboxAxiomTarget('real-time', 'ci-only'), 'real-time');
});
