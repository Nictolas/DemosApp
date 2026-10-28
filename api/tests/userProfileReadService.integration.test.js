'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Client } = require('pg');
const { loadUserResidence } = require('../services/userProfileReadService');

const pgTest = process.env.PROFILE_READ_PG_INTEGRATION === '1' ? test : test.skip;
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function withSyntheticDatabase({ profileTable = true } = {}, check) {
  const client = new Client({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
  });
  await client.connect();
  try {
    // Temporary tables exist only in this test session; no real data touched.
    await client.query('CREATE TEMP TABLE users (' +
      'id uuid PRIMARY KEY, account_type text NOT NULL DEFAULT \'PERSON\',' +
      'ruolo text, avatar_config text, data_nascita date,' +
      'grado_elezione text, grado_candidatura text, cittadinanza text,' +
      'paese_residenza text, regione_residenza text, provincia_residenza text,' +
      'comune_residenza text, attivisti text, organizzazioni text)');
    if (profileTable) {
      await client.query('CREATE TEMP TABLE user_profile (' +
        'user_id uuid PRIMARY KEY REFERENCES users(id),' +
        'avatar_config jsonb, data_nascita date, grado_elezione text,' +
        'grado_candidatura text, cittadinanza text, paese_residenza text,' +
        'regione_residenza text, provincia_residenza text, comune_residenza text)');
    }
    return await check(client);
  } finally {
    await client.end();
  }
}

pgTest('PostgreSQL 17: present profile overrides legacy residence', async () => {
  await withSyntheticDatabase({}, async (db) => {
    await db.query('INSERT INTO users(id, regione_residenza, comune_residenza) VALUES ($1,$2,$3)', [USER_A, 'TO', 'Pisa']);
    await db.query('INSERT INTO user_profile(user_id, regione_residenza, comune_residenza) VALUES ($1,$2,$3)', [USER_A, 'LA', 'Roma']);
    const row = await loadUserResidence(db, USER_A);
    assert.equal(row.regione_residenza, 'LA');
    assert.equal(row.comune_residenza, 'Roma');
  });
});

pgTest('PostgreSQL 17: account without profile retains legacy residence', async () => {
  await withSyntheticDatabase({}, async (db) => {
    await db.query('INSERT INTO users(id, paese_residenza, comune_residenza) VALUES ($1,$2,$3)', [USER_B, 'IT', 'Pisa']);
    const row = await loadUserResidence(db, USER_B);
    assert.equal(row.paese_residenza, 'IT');
    assert.equal(row.comune_residenza, 'Pisa');
  });
});

pgTest('PostgreSQL 17: null profile fields keep legacy COALESCE behavior', async () => {
  await withSyntheticDatabase({}, async (db) => {
    await db.query('INSERT INTO users(id, regione_residenza, comune_residenza) VALUES ($1,$2,$3)', [USER_A, 'TO', 'Pisa']);
    await db.query('INSERT INTO user_profile(user_id, regione_residenza, comune_residenza) VALUES ($1,$2,$3)', [USER_A, 'TO', null]);
    const row = await loadUserResidence(db, USER_A);
    assert.equal(row.comune_residenza, 'Pisa');
  });
});

pgTest('PostgreSQL 17: missing user_profile table safely falls back outside a transaction', async () => {
  await withSyntheticDatabase({ profileTable: false }, async (db) => {
    await db.query('INSERT INTO users(id, paese_residenza, comune_residenza) VALUES ($1,$2,$3)', [USER_A, 'IT', 'Pisa']);
    const row = await loadUserResidence(db, USER_A);
    assert.equal(row.comune_residenza, 'Pisa');
  });
});

pgTest('PostgreSQL 17: feed retains activism links in users', async () => {
  await withSyntheticDatabase({}, async (db) => {
    await db.query('INSERT INTO users(id, regione_residenza, attivisti, organizzazioni) VALUES ($1,$2,$3,$4)', [USER_A, 'TO', 'act-1', 'org-1']);
    await db.query('INSERT INTO user_profile(user_id, regione_residenza) VALUES ($1,$2)', [USER_A, 'LA']);
    const row = await loadUserResidence(db, USER_A, { includeFeedSelections: true });
    assert.equal(row.regione_residenza, 'LA');
    assert.equal(row.attivisti, 'act-1');
    assert.equal(row.organizzazioni, 'org-1');
  });
});

pgTest('PostgreSQL 17: aggregate preflight reports counts without identifiers', async () => {
  await withSyntheticDatabase({}, async (db) => {
    await db.query('INSERT INTO users(id, cittadinanza, comune_residenza, avatar_config) VALUES ($1,$2,$3,$4)', [USER_A, 'it', 'Pisa', '{"style":"cat"}']);
    await db.query('INSERT INTO users(id, cittadinanza, comune_residenza) VALUES ($1,$2,$3)', [USER_B, 'it', 'Lucca']);
    await db.query('INSERT INTO user_profile(user_id, cittadinanza, comune_residenza, avatar_config) VALUES ($1,$2,$3,$4::jsonb)', [USER_A, 'it', 'Roma', '{"style":"cat"}']);
    const text = fs.readFileSync(path.join(__dirname, '../database/user-profile-preflight-readonly.sql'), 'utf8');
    // Only in synthetic tests: bind explicit public schemas to isolated session TEMP tables.
    const syntheticSql = text.replace(/\bpublic\.users\b/g, 'users').replace(/\bpublic\.user_profile\b/g, 'user_profile');
    const report = (await db.query(syntheticSql)).rows[0];
    assert.equal(Number(report.users_total), 2);
    assert.equal(Number(report.profiles_present), 1);
    assert.equal(Number(report.profiles_missing), 1);
    assert.equal(Number(report.avatar_semantic_conflicts), 0);
    assert.equal(Number(report.residence_municipality_projection_changes), 1);
    assert.equal(Object.hasOwn(report, 'id'), false);
    assert.equal(Object.hasOwn(report, 'user_id'), false);
  });
});

pgTest('PostgreSQL 17: strict owner mode respects a profile NULL, while compatibility mode still falls back', async () => {
  await withSyntheticDatabase({}, async (db) => {
    await db.query('INSERT INTO users(id, comune_residenza) VALUES ($1,$2)', [USER_A, 'Pisa']);
    await db.query('INSERT INTO user_profile(user_id, comune_residenza) VALUES ($1,$2)', [USER_A, null]);
    const compatible = await loadUserResidence(db, USER_A);
    const canonical = await loadUserResidence(db, USER_A, { strictProfileOwner: true });
    assert.equal(compatible.comune_residenza, 'Pisa');
    assert.equal(canonical.comune_residenza, null);
  });
});
