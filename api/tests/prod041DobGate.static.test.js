'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.join(__dirname,'../database');
const withoutComments=s=>s.replace(/--[^\n]*/g,'')
  .replace(/\/\*[\s\S]*?\*\//g,'');

test('three-selected DOB preflight is strictly read-only and follower-private',()=>{
  const sql=withoutComments(fs.readFileSync(
    path.join(root,'20261108_three_selected_dob_preflight_READONLY.sql'),'utf8'));
  assert.match(sql,/^WITH targets\(/m);
  assert.match(sql,/READY_FOR_SEPARATE_DPO_GO_AND_REAL_BACKUP/);
  assert.match(sql,/HOLD_DUPLICATE_OR_MISSING_PROFILE/);
  assert.match(sql,/HOLD_UNEXPECTED_BIRTHDATE_OR_PARTIAL_CORRECTION/);
  assert.match(sql,/public\.user_profile/);
  assert.match(sql,/public\.political_selections/);
  assert.match(sql,/lower\(follower\.status\)='a'/);
  assert.doesNotMatch(sql,/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY|CALL|DO|EXECUTE)\b/i);
  assert.doesNotMatch(sql,/SELECT\s+[^;]*ps\.user_id\s+AS\s+follower/i);
});

test('DOB correction candidate cannot run without three independent GO gates',()=>{
  const sql=withoutComments(fs.readFileSync(
    path.join(root,'20261108_selected_public_dob_correction_REQUIRES_GO.sql'),'utf8'));
  assert.match(sql,/current_setting\('demos\.prod041_dob_approval', true\)/);
  assert.match(sql,/current_setting\('demos\.prod041_backup_restore_proven', true\)/);
  assert.match(sql,/current_setting\('demos\.prod041_official_registry_rechecked', true\)/);
  assert.doesNotMatch(sql,/\bSET\s+(?:LOCAL\s+)?demos\.prod041_/i,
    'approval flags must be provided only by an authorized reviewer');
  assert.match(sql,/FOR UPDATE OF u,p/);
  assert.match(sql,/IS DISTINCT FROM original_profile_date/);
  assert.match(sql,/IF exact_accounts <> 1/);
  assert.match(sql,/IF live_mandates <> 1/);
  assert.match(sql,/IF selected_count<1/);
  assert.match(sql,/UPDATE public\.users/);
  assert.match(sql,/UPDATE public\.user_profile/);
  assert.doesNotMatch(sql,/\b(?:DELETE|MERGE|TRUNCATE|DROP|ALTER|GRANT|REVOKE)\b/i);
  assert.equal((sql.match(/UPDATE public\./g)||[]).length,2,
    'only the two public DOB tables may be updated by this migration');
  assert.equal((sql.match(/::uuid/g)||[]).length,3,
    'exactly three pinned representative UUIDs');
});
