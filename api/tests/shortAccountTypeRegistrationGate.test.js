'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const read = file => fs.readFileSync(path.resolve(__dirname,'..',file),'utf8');

function userInsertColumns(source) {
  const sql=[...source.matchAll(/INSERT\s+INTO\s+(?:public\.)?users\s*\(([^)]*)\)/gi)];
  assert.ok(sql.length>0,'Expected a users insert statement');
  return sql.map(match=>match[1].split(',').map(x=>x.trim().toLowerCase()));
}

test('OAuth Google and Apple account creation relies on database account_type default', () => {
  const src=read('services/oauthRegistrationService.js');
  for(const columns of userInsertColumns(src)) {
    assert.ok(columns.includes('ruolo'));
    assert.ok(columns.includes('status'));
    assert.ok(!columns.includes('account_type'),
      'Explicit long account_type would break new P/O/E CHECK constraint');
  }
  assert.match(src,/const role = 'E'/);
});

test('passkey registration leaves account_type to database default', () => {
  const src=read('services/passkeyRegistrationService.js');
  for(const columns of userInsertColumns(src)) {
    assert.ok(columns.includes('ruolo'));
    assert.ok(columns.includes('status'));
    assert.ok(!columns.includes('account_type'));
  }
});

test('admin user update does not accept arbitrary account_type mutations', () => {
  const src=read('routes/users/search.js');
  const start=src.indexOf('const allowedFields = [');
  assert.ok(start>=0);
  const end=src.indexOf('];',start);
  assert.ok(end>start);
  const fields=src.slice(start,end);
  assert.doesNotMatch(fields,/['"]account_type['"]/);
  assert.doesNotMatch(fields,/['"]ruolo['"]/);
});

test('forward migration makes new persons P and preserves independent defaults', () => {
  const migration=read('database/users-account-type-poe-20261029.sql');
  assert.match(migration,/ALTER\s+COLUMN\s+account_type\s+SET\s+DEFAULT\s+'P'/i);
  assert.match(migration,/CHECK\s*\(account_type IN \('P','O','E'\)\)/);
  const role=read('database/users-role-default-e-20261029.sql');
  assert.match(role,/ALTER\s+COLUMN\s+ruolo\s+SET\s+DEFAULT\s+'E'/i);
  assert.doesNotMatch(role,/ALTER\s+COLUMN\s+status\s+SET\s+DEFAULT\s+'a'/i);
});
