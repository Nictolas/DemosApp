'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildDatabaseSsl,
  isRenderInternalHostname,
  isSupabaseHostname,
} = require('../utils/databaseTlsPolicy');

test('local PostgreSQL disables TLS', () => {
  assert.equal(buildDatabaseSsl('postgresql://u:p@localhost:5432/db'), false);
});

test('Supabase keeps verified TLS with the bundled CA', () => {
  const ssl = buildDatabaseSsl('postgresql://u:p@db.example.supabase.co:5432/postgres', { supabaseCa: 'CA' });
  assert.deepEqual(ssl, { rejectUnauthorized: true, ca: 'CA' });
  assert.equal(isSupabaseHostname('db.example.supabase.co'), true);
});

test('Render internal hostname uses encrypted self-signed TLS semantics', () => {
  assert.equal(isRenderInternalHostname('dpg-db4id8id0e5s73cfb0cg-a'), true);
  assert.deepEqual(
    buildDatabaseSsl('postgresql://u:p@dpg-db4id8id0e5s73cfb0cg-a:5432/demos_civic_staging_db'),
    { rejectUnauthorized: false },
  );
});

test('Render external and generic remote hosts keep certificate verification enabled', () => {
  assert.deepEqual(
    buildDatabaseSsl('postgresql://u:p@dpg-example-a.frankfurt-postgres.render.com:5432/db'),
    { rejectUnauthorized: true },
  );
  assert.deepEqual(buildDatabaseSsl('postgresql://u:p@postgres.example.org:5432/db'), { rejectUnauthorized: true });
});

test('Supabase never silently falls back without its CA', () => {
  assert.throws(
    () => buildDatabaseSsl('postgresql://u:p@db.example.supabase.co:5432/postgres'),
    /Supabase CA is required/,
  );
});
