'use strict';
// Runs only against the disposable CI PostgreSQL 17 instance; never Supabase.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');

function isolatedDatabaseUrl() {
  const raw = process.env.CIVIC_TEST_DATABASE_URL;
  assert.equal(process.env.CIVIC_TEST_MODE, 'isolated-synthetic',
    'Refuse database access outside the synthetic test mode');
  assert.ok(raw, 'Missing disposable CI database URL');
  const u = new URL(raw);
  assert.equal(u.hostname, '127.0.0.1', 'Never connect to a remote or real database');
  assert.equal(u.pathname, '/demos_civic_ci', 'Unexpected database name');
  assert.equal(u.port, '5432', 'Unexpected PostgreSQL port');
  return raw;
}

function queryFromSource() {
  const source = fs.readFileSync(path.join(__dirname, '../routes/capo-stato.js'), 'utf8');
  const listing = source.match(/const classificaQuery = \`([\s\S]*?)\`;/);
  const gate = source.match(/const allowed = await pool\.query\(\s*\`([\s\S]*?)\`,\s*\[voti\[0\]\]/);
  assert.ok(listing && gate, 'Cannot find the production SQL for ranking/vote gate');
  return { listing: listing[1], gate: gate[1] };
}

test('approved Capo subjects appear at zero votes; only historical or approved names pass vote gate', async () => {
  const {listing, gate} = queryFromSource();
  const client = new Client({ connectionString: isolatedDatabaseUrl() });
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE voti_capo_stato (nome text NOT NULL)');
    await client.query('CREATE TEMP TABLE capo_stato_soggetti_approvati (nome text NOT NULL, active boolean NOT NULL)');
    await client.query("INSERT INTO voti_capo_stato(nome) VALUES ('Persona storica'), ('Persona storica')");
    await client.query("INSERT INTO capo_stato_soggetti_approvati(nome,active) VALUES ('Persona nuova approvata',true), ('Persona disattivata',false)");

    const ranked = (await client.query(listing)).rows;
    const legacy = ranked.find(row => row.nome === 'Persona storica');
    const approved = ranked.find(row => row.nome === 'Persona nuova approvata');
    assert.ok(legacy, 'historical ranking must remain available');
    assert.equal(Number(legacy.voti), 2);
    assert.ok(approved, 'approved subject must appear before anyone votes');
    assert.equal(Number(approved.voti), 0);
    assert.equal(ranked.some(row => row.nome === 'Persona disattivata'), false);

    for (const [name, expected] of [
      ['Persona storica', true],
      ['Persona nuova approvata', true],
      ['Persona disattivata', false],
      ['Persona arbitraria non approvata', false],
    ]) {
      const result = await client.query(gate, [name]);
      assert.equal(result.rowCount > 0, expected, 'Invalid whitelist result for ' + name);
    }
  } finally {
    await client.query('ROLLBACK').catch(() => {});
    await client.end();
  }
});
