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
