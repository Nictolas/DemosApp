const test = require('node:test');
const assert = require('node:assert/strict');

const {
  ACCOUNT_TYPES,
  capabilitiesFromLegacyRole,
  deriveLegacyRole,
  getAccountSubject,
  queryWithAccountModelFallback
} = require('../services/accountCapabilitiesService');

test('legacy roles map to composable capabilities', () => {
  assert.deepEqual(capabilitiesFromLegacyRole('E'), {
    accountType: ACCOUNT_TYPES.PERSON,
    isAdmin: false,
    isActivist: false,
    isCandidate: false,
    isPolitician: false
  });
  assert.equal(capabilitiesFromLegacyRole('P').isPolitician, true);
  assert.equal(capabilitiesFromLegacyRole('C').isCandidate, true);
  assert.deepEqual(capabilitiesFromLegacyRole('CP'), {
    accountType: ACCOUNT_TYPES.PERSON,
    isAdmin: false,
    isActivist: false,
    isCandidate: true,
    isPolitician: true
  });
  assert.equal(capabilitiesFromLegacyRole('A').isActivist, true);
  assert.equal(capabilitiesFromLegacyRole('AD').isAdmin, true);
  assert.equal(capabilitiesFromLegacyRole('I').accountType, ACCOUNT_TYPES.INSTITUTION);
  assert.equal(capabilitiesFromLegacyRole('O').accountType, ACCOUNT_TYPES.ORGANIZATION);
});

test('human-readable legacy aliases are normalized', () => {
  assert.equal(capabilitiesFromLegacyRole('Politico').isPolitician, true);
  assert.equal(capabilitiesFromLegacyRole('Candidato').isCandidate, true);
  assert.equal(capabilitiesFromLegacyRole('Candidato Politico').isPolitician, true);
  assert.equal(capabilitiesFromLegacyRole('Candidato Politico').isCandidate, true);
  assert.equal(capabilitiesFromLegacyRole('Istituzione').accountType, ACCOUNT_TYPES.INSTITUTION);
  assert.equal(capabilitiesFromLegacyRole('Organizzazione').accountType, ACCOUNT_TYPES.ORGANIZATION);
});

test('legacy projection keeps entity types and composes politician + candidate as CP', () => {
  assert.equal(deriveLegacyRole({ accountType: ACCOUNT_TYPES.INSTITUTION }), 'I');
  assert.equal(deriveLegacyRole({ accountType: ACCOUNT_TYPES.ORGANIZATION }), 'O');
  assert.equal(deriveLegacyRole({ accountType: ACCOUNT_TYPES.PERSON, isPolitician: true, isCandidate: true }), 'CP');
  assert.equal(deriveLegacyRole({ accountType: ACCOUNT_TYPES.PERSON, isPolitician: true }), 'P');
  assert.equal(deriveLegacyRole({ accountType: ACCOUNT_TYPES.PERSON, isCandidate: true }), 'C');
  assert.equal(deriveLegacyRole({ accountType: ACCOUNT_TYPES.PERSON, isActivist: true }), 'A');
  assert.equal(deriveLegacyRole({ accountType: ACCOUNT_TYPES.PERSON }), 'E');
});

test('admin remains the compatibility legacy role while public capabilities stay composable', () => {
  assert.equal(
    deriveLegacyRole({
      accountType: ACCOUNT_TYPES.PERSON,
      isAdmin: true,
      isPolitician: true,
      isCandidate: true,
      isActivist: true
    }),
    'AD'
  );
});

test('new schema is authoritative when available', async () => {
  const calls = [];
  const pool = {
    async query(sql, values) {
      calls.push({ sql, values });
      return {
        rows: [{
          id: '11111111-1111-1111-1111-111111111111',
          status: 'a',
          account_type: 'PERSON',
          is_admin: false,
          is_activist: true,
          is_candidate: true,
          is_politician: true
        }]
      };
    }
  };

  const subject = await getAccountSubject(pool, '11111111-1111-1111-1111-111111111111');
  assert.equal(calls.length, 1);
  assert.equal(subject.legacyRole, 'CP');
  assert.equal(subject.capabilities.isActivist, true);
  assert.equal(subject.capabilities.isCandidate, true);
  assert.equal(subject.capabilities.isPolitician, true);
});

test('missing new schema falls back to legacy role without breaking authentication', async () => {
  let call = 0;
  const pool = {
    async query() {
      call += 1;
      if (call === 1) {
        const error = new Error('column account_type does not exist');
        error.code = '42703';
        throw error;
      }
      return { rows: [{ id: 'u1', status: 'a', ruolo: 'CP' }] };
    }
  };

  const subject = await getAccountSubject(pool, 'u1');
  assert.equal(call, 2);
  assert.equal(subject.legacyRole, 'CP');
  assert.equal(subject.capabilities.isPolitician, true);
  assert.equal(subject.capabilities.isCandidate, true);
});

test('missing relation also falls back to legacy role', async () => {
  let call = 0;
  const pool = {
    async query() {
      call += 1;
      if (call === 1) {
        const error = new Error('relation political_mandates does not exist');
        error.code = '42P01';
        throw error;
      }
      return { rows: [{ id: 'u2', status: 'a', ruolo: 'A' }] };
    }
  };

  const subject = await getAccountSubject(pool, 'u2');
  assert.equal(subject.legacyRole, 'A');
  assert.equal(subject.capabilities.isActivist, true);
});

test('unexpected database errors are not swallowed', async () => {
  const pool = {
    async query() {
      const error = new Error('connection lost');
      error.code = '08006';
      throw error;
    }
  };
  await assert.rejects(() => getAccountSubject(pool, 'u3'), /connection lost/);
});

test('missing user returns null in new schema path', async () => {
  const pool = { async query() { return { rows: [] }; } };
  assert.equal(await getAccountSubject(pool, 'missing'), null);
});


test('account-model query prefers canonical schema and falls back only on additive-schema errors', async () => {
  const modernPool = { async query(sql) { return { rows: [{ sql }] }; } };
  const modern = await queryWithAccountModelFallback(modernPool, 'MODERN', 'LEGACY');
  assert.equal(modern.rows[0].sql, 'MODERN');

  let call = 0;
  const legacyPool = { async query(sql) {
    call += 1;
    if (call === 1) { const error = new Error('missing column'); error.code = '42703'; throw error; }
    return { rows: [{ sql }] };
  }};
  const legacy = await queryWithAccountModelFallback(legacyPool, 'MODERN', 'LEGACY');
  assert.equal(legacy.rows[0].sql, 'LEGACY');
  assert.equal(call, 2);
});

test('account-model query never hides unrelated database failures', async () => {
  const pool = { async query() { const error = new Error('connection lost'); error.code = '08006'; throw error; } };
  await assert.rejects(() => queryWithAccountModelFallback(pool, 'MODERN', 'LEGACY'), /connection lost/);
});
