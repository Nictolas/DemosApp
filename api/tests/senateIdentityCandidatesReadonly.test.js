'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

test('Senate crosswalk candidate audit cannot mutate personal or nominal data',()=>{
  const sql=fs.readFileSync(path.join(__dirname,
    '../database/20261108_senate_identity_candidates_readonly.sql'),'utf8');
  const body=sql.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(body,/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY|CALL|DO)\b/i);
  assert.match(body,/SELECT COUNT\(\*\)::integer AS candidate_pairs/);
  assert.match(body,/birth_date=public_birth_date/);
  assert.match(body,/birth_date<>public_birth_date/);
  assert.match(body,/per_rep=1 AND per_official_uri=1 AND per_profile=1/);
  assert.match(body,/UNVERIFIED_REQUIRES_OFFICIAL_REGISTRY_REVIEW/);
  assert.doesNotMatch(body,/ON CONFLICT|information_schema|pg_catalog/i);
});

test('selected-only reviewer queue is read-only, follower-private and scoped to active selections',()=>{
  const sql=fs.readFileSync(path.join(__dirname,
    '../database/20261108_selected_mp_identity_review_readonly.sql'),'utf8');
  const body=sql.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(body,/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY|CALL|DO)\b/i);
  assert.match(body,/COUNT\(DISTINCT representative_id\)/);
  assert.match(body,/lower\(follower\.status\)='a'/);
  assert.match(body,/ps\.selection_kind='representative'/);
  assert.match(body,/m\.status='ACTIVE'/);
  assert.match(body,/SELECT s\.political_office_id, s\.representative_id, u\.nome, u\.cognome/);
  assert.doesNotMatch(body,/SELECT\s+[^;]*ps\.user_id\s+AS\s+follower/i);
  assert.doesNotMatch(body,/ON CONFLICT|information_schema|pg_catalog/i);
});
