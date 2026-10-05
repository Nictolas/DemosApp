const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseResearchDatabaseUrl,
  normalizeDatabaseUrl,
  isLocalDatabaseUrl
} = require('../config/researchDatabase');

test('Research database URL accepts explicit PostgreSQL URLs with required connection identity', () => {
  const url = parseResearchDatabaseUrl('postgresql://research_user:secret@db.example.test:5432/research?pgbouncer=true');
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.hostname, 'db.example.test');
  assert.equal(url.username, 'research_user');
  assert.equal(url.pathname, '/research');
});

test('Research database URL fails closed on malformed or non-PostgreSQL connection strings', () => {
  for (const value of [
    undefined,
    '',
    ' postgresql://user:secret@db.example.test/research',
    'postgresql://user:secret@db.example.test/research ',
    'https://user:secret@db.example.test/research',
    'postgresql:///research',
    'postgresql://db.example.test/research',
    'postgresql://user:secret@db.example.test/',
    'postgresql://user:secret@db.example.test/research#fragment'
  ]) {
    assert.throws(() => parseResearchDatabaseUrl(value), /RESEARCH_DATABASE_URL/);
  }
});

test('Research database URL strips caller-controlled TLS query parameters but preserves unrelated parameters', () => {
  const normalized = new URL(normalizeDatabaseUrl(
    'postgresql://user:secret@db.example.test/research?sslmode=disable&sslcert=x&sslkey=y&sslrootcert=z&sslaccept=accept_invalid_certs&pgbouncer=true'
  ));

  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslaccept']) {
    assert.equal(normalized.searchParams.has(key), false);
  }
  assert.equal(normalized.searchParams.get('pgbouncer'), 'true');
});

test('Research database TLS exemption is restricted to exact loopback hosts', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(isLocalDatabaseUrl(`postgresql://user:secret@${host}/research`), true);
  }
  for (const host of ['localhost.example.test', '127.0.0.2', 'db.example.test']) {
    assert.equal(isLocalDatabaseUrl(`postgresql://user:secret@${host}/research`), false);
  }
});
