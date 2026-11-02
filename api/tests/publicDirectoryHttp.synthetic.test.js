'use strict';
// Public directories: real Express routers and loopback HTTP, synthetic database only.
// No provider credentials, real user data, writes, or external network calls.
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');

const privatePerson = {
  id: '11111111-1111-4111-8111-111111111111',
  nome: 'Persona sintetica',
  cognome: 'Esempio',
  email: 'private@example.invalid',
  ruolo: 'A',
  status: 'A',
  created_at: '2026-01-01',
  updated_at: '2026-06-01',
  avatar_config: '{}',
  genere: 'F',
  data_nascita: '1990-01-01',
  cittadinanza: 'test-secret',
  paese_residenza: 'test-secret',
  regione_residenza: 'TO',
  provincia_residenza: 'test-secret',
  comune_residenza: 'test-secret',
  facebook_url: 'https://example.invalid/profile',
  tipologie_attivismo: [{ tipo: 'ambiente' }]
};

let failDatabase = false;
const queries = [];
const fakePool = {
  async query(statement) {
    const sql = String(statement);
    queries.push(sql);
    if (failDatabase) throw new Error('PRIVATE_DB_CREDENTIAL_OR_SQL_ERROR');
    if (!/^\s*SELECT\b/i.test(sql)) throw new Error('Read-only test forbids DB writes');
    if (sql.includes('FROM subject_proposals')) {
      return { rows: [{ id: 'approved-fixture', title: 'Soggetto approvato' }] };
    }
    if (sql.includes('FROM users u')) {
      // Simulate PostgreSQL SELECT projection: a private column appears in JSON
      // iff the real route asked for that column. This detects SELECT regressions.
      const projection = sql.match(/\bSELECT\s+([\s\S]*?)\s+FROM users u\b/i)?.[1];
      assert.ok(projection, 'expected user list SELECT');
      assert.doesNotMatch(projection, /\b(?:u\.)?\*\b|\bu\.\*/, 'no SELECT * from public user profiles');
      const row = {};
      for (const [column, value] of Object.entries(privatePerson)) {
        const pattern = new RegExp('\\b(?:u\\.)?' + column + '\\b(?=\\s*,|\\s+FROM\\b)');
        if (pattern.test(projection)) row[column] = value;
      }
      if (/\bAS supporters_count\b/i.test(projection)) row.supporters_count = 3;
      return { rows: [row] };
    }
    return { rows: [] };
  }
};

// Override only provider dependencies before importing the production routers.
const db = require.resolve('../config/database');
const accounts = require.resolve('../services/accountCapabilitiesService');
require.cache[db] = { id: db, filename: db, loaded: true, exports: { getPool: () => fakePool } };
require.cache[accounts] = {
  id: accounts, filename: accounts, loaded: true,
  exports: {
    queryWithAccountModelFallback: (_pool, modernSql, _legacySql, values) =>
      fakePool.query(modernSql, values)
  }
};

const app = express();
app.use('/api/attivisti', require('../routes/attivisti'));
app.use('/api/organizzazioni', require('../routes/organizzazioni'));
const server = http.createServer(app);
let origin;
async function request(path) {
  if (!origin) {
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = 'http://127.0.0.1:' + server.address().port;
  }
  return fetch(origin + path);
}
after(async () => {
  if (server.listening) await new Promise(resolve => server.close(resolve));
});

async function checkPublicDirectory(path, expectApproved) {
  const response = await request(path);
  assert.equal(response.status, 200, 'GET ' + path);
  assert.match(response.headers.get('cache-control') || '', /no-store/);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.length, 1);
  const user = payload.data[0];
  assert.equal(user.nome, privatePerson.nome);
  assert.equal(user.id, privatePerson.id);
  assert.equal(user.regione_residenza, 'TO');
  assert.equal(user.avatar_config, '{}');
  assert.deepEqual(user.tipologie_attivismo, [{ tipo: 'ambiente' }]);
  for (const field of [
    'email', 'genere', 'data_nascita', 'cittadinanza',
    'paese_residenza', 'provincia_residenza', 'comune_residenza',
    'status', 'created_at', 'updated_at'
  ]) {
    assert.equal(Object.hasOwn(user, field), false, 'public field leak: ' + field);
  }
  if (expectApproved) {
    assert.deepEqual(payload.approved_subjects, [{ id: 'approved-fixture', title: 'Soggetto approvato' }]);
  }
  assert.doesNotMatch(JSON.stringify(payload), /private@example\.invalid|test-secret/);
}

test('GET /api/attivisti anonymized public projection', async () => {
  await checkPublicDirectory('/api/attivisti', true);
});

test('GET /api/attivisti/tipologia/:tipo also excludes personal columns', async () => {
  await checkPublicDirectory('/api/attivisti/tipologia/ambiente', false);
});

test('GET /api/organizzazioni anonymized public projection', async () => {
  await checkPublicDirectory('/api/organizzazioni', true);
});

test('database errors do not expose SQL or credentials in public JSON', async () => {
  failDatabase = true;
  try {
    for (const path of ['/api/attivisti', '/api/organizzazioni']) {
      const response = await request(path);
      assert.equal(response.status, 500);
      assert.doesNotMatch(JSON.stringify(await response.json()), /PRIVATE_DB_CREDENTIAL_OR_SQL_ERROR/);
      assert.match(response.headers.get('cache-control') || '', /no-store/);
    }
  } finally {
    failDatabase = false;
  }
});

test('all database calls from public directory HTTP fixtures are reads', () => {
  assert.ok(queries.length >= 5);
  for (const sql of queries) assert.match(sql, /^\s*SELECT\b/i);
});
