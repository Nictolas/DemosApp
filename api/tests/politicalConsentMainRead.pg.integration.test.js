'use strict';
// PostgreSQL 17 is an ephemeral CI service only. Do not use Supabase/Render or
// real user data. The test refuses any non-local URI before attempting a socket.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { getOpinionMapsByUserId } = require('../services/politicalMatchingService');

const urlString = process.env.CIVIC_TEST_DATABASE_URL;
const enabled = process.env.CIVIC_TEST_MODE === 'isolated-synthetic' && !!urlString;
test('Postgres17: requester + candidates obey consent and override inside one indexed batch read', { skip: !enabled }, async () => {
  const config = new URL(urlString);
  assert.equal(config.hostname, '127.0.0.1', 'external PG endpoints forbidden');
  assert.equal(config.port, '5432', 'only isolated CI database');
  assert.equal(config.username, 'demos_ci', 'only disposable CI SQL account');
  assert.equal(config.pathname, '/demos_political_ci', 'disposable CI DB required');
  const { Client } = require('pg');
  const client = new Client({connectionString:urlString,connectionTimeoutMillis:3000});
  await client.connect();
  try {
    await client.query('BEGIN');
    await client.query('CREATE TEMP TABLE users(id text PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE user_consents(user_id text PRIMARY KEY, political_opinions_consent boolean)');
    await client.query('CREATE TEMP TABLE opinioni_risposte(user_id text PRIMARY KEY, o1 text, o2 text)');
    await client.query("INSERT INTO users VALUES ('owner',true),('candidate',true),('revoked',true),('legacy',false),('absent',null)");
    await client.query("INSERT INTO user_consents VALUES ('owner',true),('candidate',true),('revoked',false),('legacy',true)");
    await client.query("INSERT INTO opinioni_risposte VALUES ('owner','f','c'),('candidate','f','i'),('revoked','f','f'),('legacy','c','c'),('absent','f','c')");
    const ids = ['owner','candidate','revoked','legacy','absent'];
    const run = () => getOpinionMapsByUserId(client,ids,['o1','o2']);
    let maps = await run();
    assert.equal(maps.get('owner').o1,'f');
    assert.equal(maps.get('candidate').o2,'i');
    assert.deepEqual(maps.get('revoked'),{});
    assert.equal(maps.get('legacy').o1,'c','explicit current consent allows a legacy=false user');
    assert.deepEqual(maps.get('absent'),{},'missing consent fails closed');
    await client.query("UPDATE user_consents SET political_opinions_consent=false WHERE user_id IN ('owner','candidate')");
    maps = await run();
    assert.deepEqual(maps.get('owner'),{},'revoked requester has no opinion data');
    assert.deepEqual(maps.get('candidate'),{},'revoked candidate has no matching data');
    assert.deepEqual(maps.get('revoked'),{});
    assert.equal(maps.size,5,'same one-query batch API and no deleted records');
    await client.query('ROLLBACK');
  } finally {
    await client.end();
  }
});
