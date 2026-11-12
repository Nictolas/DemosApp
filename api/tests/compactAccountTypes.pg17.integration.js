'use strict';

// Real PostgreSQL 17 protocol test against a synthetic, isolated CI schema.
// Never run against production; requires the explicit CI-only database name.
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { getAccountSubject } = require('../services/accountCapabilitiesService');

const IDS = Object.freeze({
  politician: '00000000-0000-4000-8000-000000000001',
  elector: '00000000-0000-4000-8000-000000000002',
  organization: '00000000-0000-4000-8000-000000000003',
  institution: '00000000-0000-4000-8000-000000000004',
  legacyCandidatePolitician: '00000000-0000-4000-8000-000000000005',
  activist: '00000000-0000-4000-8000-000000000006'
});

async function run() {
  if (
    process.env.GITHUB_ACTIONS !== 'true' ||
    process.env.PGHOST !== 'localhost' ||
    process.env.PGUSER !== 'postgres' ||
    process.env.PGDATABASE !== 'postgres' ||
    process.env.PGPORT !== '5432'
  ) {
    throw new Error('Refusing to connect outside the explicitly configured GitHub PostgreSQL 17 fixture');
  }
  const format = process.argv[2];
  assert.ok(['short', 'long'].includes(format), 'Expected storage mode long or short');
  const expectedTypes = format === 'short'
    ? { PERSON: 'P', ORGANIZATION: 'O', INSTITUTION: 'E' }
    : { PERSON: 'PERSON', ORGANIZATION: 'ORGANIZATION', INSTITUTION: 'INSTITUTION' };

  const pool = new Pool({ connectionTimeoutMillis: 2000, statement_timeout: 5000 });
  try {
    const meta = (await pool.query('SELECT current_database() db, current_setting($1)::integer version', ['server_version_num'])).rows[0];
    assert.equal(meta.db, 'postgres');
    assert.equal(Math.floor(meta.version / 10000), 17);

    const fixtures = [
      ['politician', 'PERSON', 'P'],
      ['elector', 'PERSON', 'E'],
      ['organization', 'ORGANIZATION', 'O'],
      ['institution', 'INSTITUTION', 'I'],
      ['legacyCandidatePolitician', 'PERSON', 'CP'],
      ['activist', 'PERSON', format === 'long' ? 'AD' : 'A']
    ];
    for (const [key, type, role] of fixtures) {
      const raw = (await pool.query('SELECT account_type, ruolo, status FROM public.users WHERE id=$1', [IDS[key]])).rows[0];
      assert.ok(raw, 'Synthetic account missing: ' + key);
      assert.equal(raw.account_type, expectedTypes[type]);
      assert.equal(raw.ruolo, role, 'Role must match its tested state; rollback fixture grants admin after verification');
      assert.equal(raw.status, 'a');

      const subject = await getAccountSubject(pool, IDS[key]);
      assert.equal(subject.capabilities.accountType, type, 'Public API must keep descriptive type');
      assert.equal(subject.status, 'a');
    }

    // Verify real SQL against verified mandate, not a mock query string.
    await pool.query(
      "INSERT INTO public.political_mandates (user_id,status,source,starts_at,ends_at) VALUES ($1,'ACTIVE','OFFICIAL', NOW() - INTERVAL '1 day', NULL)",
      [IDS.politician]
    );
    const withMandate = await getAccountSubject(pool, IDS.politician);
    assert.equal(withMandate.capabilities.isPolitician, true);
    assert.equal(withMandate.legacyRole, 'P');

    const json = (await pool.query("SELECT jsonb_build_object('account_type', account_type, 'ruolo', ruolo) AS info FROM public.users WHERE id=$1", [IDS.institution])).rows[0].info;
    assert.equal(json.account_type, expectedTypes.INSTITUTION);
    assert.equal(json.ruolo, 'I');
    console.log('COMPACT_ACCOUNT_TYPES_REAL_PG17_PASS', JSON.stringify({ mode: format, cases: fixtures.length, verifiedMandate: true }));
  } finally {
    await pool.end();
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
