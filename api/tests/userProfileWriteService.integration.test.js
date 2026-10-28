'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { upsertUserProfileFields } = require('../services/userProfileWriteService');

const pgTest = process.env.PROFILE_READ_PG_INTEGRATION === '1' ? test : test.skip;
const ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

async function withSyntheticDb(fn) {
  const client = new Client({
    host: process.env.PGHOST || '127.0.0.1',
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER || 'postgres',
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE || 'postgres',
  });
  await client.connect();
  try {
    await client.query('CREATE TEMP TABLE users (id uuid PRIMARY KEY, cittadinanza text, comune_residenza text, grado_elezione text, avatar_config text)');
    await client.query('CREATE TEMP TABLE user_profile (user_id uuid PRIMARY KEY REFERENCES users(id), cittadinanza text, comune_residenza text, grado_elezione text, avatar_config jsonb, updated_at timestamptz DEFAULT NOW())');
    await client.query('INSERT INTO users (id, cittadinanza, comune_residenza, grado_elezione) VALUES ($1,$2,$3,$4)', [ID, 'it', 'Pisa', 'CO']);
    await client.query('INSERT INTO user_profile (user_id, cittadinanza, comune_residenza, grado_elezione) VALUES ($1,$2,$3,$4)', [ID, 'it', 'Pisa', 'CO']);
    return await fn(client);
  } finally {
    await client.end();
  }
}

pgTest('PG17: admin-style change is atomically mirrored and committed', async () => {
  await withSyntheticDb(async (db) => {
    await db.query('BEGIN');
    await db.query('UPDATE users SET comune_residenza=$1, grado_elezione=$2 WHERE id=$3', ['Lucca', 'R', ID]);
    await upsertUserProfileFields(db, ID, { comune_residenza: 'Lucca', grado_elezione: 'R' });
    await db.query('COMMIT');
    const result = await db.query('SELECT u.comune_residenza legacy, p.comune_residenza profile, u.grado_elezione legacy_grade, p.grado_elezione profile_grade FROM users u JOIN user_profile p ON p.user_id=u.id WHERE u.id=$1', [ID]);
    assert.deepEqual(result.rows[0], { legacy: 'Lucca', profile: 'Lucca', legacy_grade: 'R', profile_grade: 'R' });
  });
});

pgTest('PG17: a failed mirror write rolls back the account edit too', async () => {
  await withSyntheticDb(async (db) => {
    await db.query('BEGIN');
    await db.query('UPDATE users SET comune_residenza=$1 WHERE id=$2', ['Lucca', ID]);
    await assert.rejects(upsertUserProfileFields(db, ID, { avatar_config: '{not json}' }), /invalid input syntax for type json/i);
    await db.query('ROLLBACK');
    const result = await db.query('SELECT u.comune_residenza legacy, p.comune_residenza profile FROM users u JOIN user_profile p ON p.user_id=u.id WHERE u.id=$1', [ID]);
    assert.deepEqual(result.rows[0], { legacy: 'Pisa', profile: 'Pisa' });
  });
});

pgTest('PG17: null clears both mirrored fields, JSONB stays semantically valid', async () => {
  await withSyntheticDb(async (db) => {
    await db.query('BEGIN');
    await db.query('UPDATE users SET comune_residenza=$1, avatar_config=$2 WHERE id=$3', [null, '{"color":"blue"}', ID]);
    await upsertUserProfileFields(db, ID, { comune_residenza: null, avatar_config: '{"color":"blue"}' });
    await db.query('COMMIT');
    const result = await db.query('SELECT u.comune_residenza legacy, p.comune_residenza profile, p.avatar_config FROM users u JOIN user_profile p ON p.user_id=u.id WHERE u.id=$1', [ID]);
    assert.equal(result.rows[0].legacy, null);
    assert.equal(result.rows[0].profile, null);
    assert.deepEqual(result.rows[0].avatar_config, {color:'blue'});
  });
});
