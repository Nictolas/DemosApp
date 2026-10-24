'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  SENSITIVE_TABLES, validatePublicKey, buildProbeUrl, classifyStatus, probeOne, audit
} = require('../scripts/verify-supabase-data-api-exposure.cjs');

const projectUrl = 'https://example.supabase.co/';
const anonKey = 'sb_publishable_unit_test_only';

function fakeLegacyJwt(role) {
  const encode = (object) => Buffer.from(JSON.stringify(object)).toString('base64url');
  return encode({ alg: 'HS256' }) + '.' + encode({ role }) + '.signature';
}

test('rejects secret and service-role keys even when legacy JWT formatted', () => {
  for (const key of ['sb_secret_do_not_use', 'sb_service_do_not_use', 'sk_wrong', fakeLegacyJwt('service_role')]) {
    assert.throws(() => validatePublicKey(key));
  }
  assert.equal(validatePublicKey(fakeLegacyJwt('anon')), fakeLegacyJwt('anon'));
  assert.equal(validatePublicKey(anonKey), anonKey);
});

test('probes only HTTPS exact project base, never arbitrary path/table names', () => {
  assert.throws(() => buildProbeUrl('http://example.supabase.co/', 'users'));
  assert.throws(() => buildProbeUrl(projectUrl + 'rest/v1/', 'users'));
  assert.throws(() => buildProbeUrl(projectUrl, 'users?select=*'));
  const url = new URL(buildProbeUrl(projectUrl, 'users'));
  assert.equal(url.pathname, '/rest/v1/users');
  assert.equal(url.searchParams.get('limit'), '0');
});

test('classifies authorized sensitive table as failed, denied as pass, others inconclusive', () => {
  assert.equal(classifyStatus(200), 'endpoint-accessible');
  assert.equal(classifyStatus(206), 'endpoint-accessible');
  assert.equal(classifyStatus(403), 'denied');
  assert.equal(classifyStatus(401), 'denied');
  assert.equal(classifyStatus(404), 'denied');
  assert.equal(classifyStatus(503), 'inconclusive');
  assert.equal(classifyStatus(429), 'inconclusive');
});

test('HEAD probe requests no rows and never handles a response body', async () => {
  let calls = 0;
  const fakeFetch = async (url, opts) => {
    calls += 1;
    assert.equal(opts.method, 'HEAD');
    assert.equal(opts.headers.apikey, anonKey);
    assert.ok(!('Authorization' in opts.headers));
    assert.equal(new URL(url).searchParams.get('limit'), '0');
    assert.equal(opts.redirect, 'manual');
    return { status: 403, json() { throw new Error('Body must not be read'); } };
  };
  const result = await probeOne({ projectUrl, publicKey: anonKey, table: 'users', fetchImpl: fakeFetch });
  assert.deepEqual(result, { table: 'users', status: 403, result: 'denied' });
  assert.equal(calls, 1);
});

test('audit identifies exposure without leaking records or credentials', async () => {
  assert.ok(SENSITIVE_TABLES.includes('opinioni_risposte'));
  assert.ok(SENSITIVE_TABLES.includes('users'));
  const outcomes = [200, 403, 500];
  let index = 0;
  const results = await audit({
    projectUrl, publicKey: anonKey, tables: ['users', 'opinioni_risposte', 'identity_verifications'],
    fetchImpl: async () => ({ status: outcomes[index++] })
  });
  assert.deepEqual(results.accessible, ['users']);
  assert.deepEqual(results.inconclusive, ['identity_verifications']);
  assert.equal(results.checks[1].result, 'denied');
});

test('network error is inconclusive, not a false safe result', async () => {
  const result = await probeOne({
    projectUrl, publicKey: anonKey, table: 'users',
    fetchImpl: async () => { throw new Error('redacted credential'); }
  });
  assert.deepEqual(result, { table: 'users', status: null, result: 'inconclusive' });
});
