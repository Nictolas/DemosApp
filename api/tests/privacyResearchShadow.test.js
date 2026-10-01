const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const {
  collectForbiddenResearchIdentityKeys,
  assertResearchPayloadSeparated
} = require('../services/researchShadowPolicy');

const schemaPath = path.join(
  __dirname,
  '..',
  '..',
  'supabase',
  'schemas',
  'privacy_first_shadow.sql'
);

const readShadowSql = () => fs.readFileSync(schemaPath, 'utf8');

const getCreateTableBlock = (sql, qualifiedTable) => {
  const pattern = new RegExp(
    'create table if not exists ' +
      qualifiedTable.replace('.', '\\.') +
      ' \\(([\\s\\S]*?)\\n\\);',
    'i'
  );
  const match = sql.match(pattern);
  assert.ok(match, 'missing ' + qualifiedTable + ' definition');
  return match[1].toLowerCase();
};

test('research payload accepts pseudonymous fields', () => {
  assert.equal(assertResearchPayloadSeparated({
    participant_id: 'participant-1',
    question_id: 'energia_nucleare',
    answer_code: 'f',
    dimensions: {
      region_code: '09',
      age_bucket: '35-44'
    }
  }), true);
});

test('research payload rejects direct identity fields, including nested ones', () => {
  const paths = collectForbiddenResearchIdentityKeys({
    participant_id: 'participant-1',
    profile: {
      email: 'utente@example.test',
      nested: { user_id: 'user-123' }
    }
  });

  assert.deepEqual(paths.sort(), ['$.profile.email', '$.profile.nested.user_id']);

  assert.throws(
    () => assertResearchPayloadSeparated({ account_id: 'user-123' }),
    (error) =>
      error &&
      error.code === 'RESEARCH_IDENTITY_LINK_FORBIDDEN' &&
      error.forbiddenPaths.includes('$.account_id')
  );
});

test('shadow SQL does not put direct account identifiers in research tables', () => {
  const sql = readShadowSql();
  const researchTables = [
    'participants',
    'spent_credentials',
    'participant_dimensions',
    'opinion_response_events'
  ];

  for (const table of researchTables) {
    const block = getCreateTableBlock(sql, 'research.' + table);

    for (const forbidden of [
      'account_id',
      'user_id',
      'email',
      'fiscal_number',
      'google_sub',
      'apple_user_id',
      'firestore_uid'
    ]) {
      assert.equal(
        block.includes(forbidden),
        false,
        'research table unexpectedly contains ' + forbidden
      );
    }
  }
});

test('Identity issuance is limited to one credential per account, purpose and epoch', () => {
  const sql = readShadowSql();
  const block = getCreateTableBlock(sql, 'identity.credential_issuances');

  assert.match(
    block,
    /unique\s*\(\s*account_id\s*,\s*purpose\s*,\s*epoch\s*\)/,
    'identity issuance must enforce one credential per account/purpose/epoch'
  );

  for (const forbidden of ['participant_id', 'credential_digest', 'token']) {
    assert.equal(
      block.includes(forbidden),
      false,
      'identity issuance must not persist Research/token linkage: ' + forbidden
    );
  }
});

test('Research anti-replay spent set is one-shot and contains no Identity or participant identifier', () => {
  const sql = readShadowSql();
  const block = getCreateTableBlock(sql, 'research.spent_credentials');

  assert.match(
    block,
    /credential_digest\s+bytea\s+primary\s+key/,
    'spent credential digest must be the one-shot primary key'
  );

  for (const forbidden of [
    'account_id',
    'user_id',
    'participant_id',
    'email',
    'fiscal_number',
    'session_id'
  ]) {
    assert.equal(
      block.includes(forbidden),
      false,
      'spent credential set must not contain linkable identifier: ' + forbidden
    );
  }
});

test('shadow SQL removes browser-role access and enables RLS', () => {
  const sql = readShadowSql().toLowerCase();

  for (const schema of ['identity', 'research', 'content', 'politics', 'audit']) {
    assert.ok(
      sql.includes('revoke all on schema ' + schema + ' from public, anon, authenticated;'),
      'missing schema revoke for ' + schema
    );
  }

  for (const table of [
    'research.participants',
    'research.spent_credentials',
    'research.participant_dimensions',
    'research.opinion_response_events'
  ]) {
    assert.ok(
      sql.includes('alter table ' + table + ' enable row level security;'),
      'missing RLS enable for ' + table
    );
    assert.ok(
      sql.includes('alter table ' + table + ' force row level security;'),
      'missing RLS force for ' + table
    );
  }
});

test('Research service is isolated from normal account auth and DATABASE_URL', () => {
  const researchApp = fs.readFileSync(
    path.join(__dirname, '..', 'research-app.js'),
    'utf8'
  ).toLowerCase();
  const researchDatabase = fs.readFileSync(
    path.join(__dirname, '..', 'config', 'researchDatabase.js'),
    'utf8'
  );

  assert.equal(researchApp.includes("middleware/auth"), false);
  assert.equal(researchApp.includes("config/database"), false);
  assert.equal(researchApp.includes("verifytoken"), false);

  assert.ok(researchDatabase.includes('RESEARCH_DATABASE_URL'));
  assert.equal(
    /process\.env\.DATABASE_URL/.test(researchDatabase),
    false,
    'Research DB config must never fall back to the main DATABASE_URL'
  );
});
