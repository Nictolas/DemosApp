'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const sql=fs.readFileSync(path.join(__dirname,
  '../database/20261108_ep_selected_identity_review_readonly.sql'),'utf8');

test('selected European identity review uses correct UUID syntax, never matches 28-character legacy identifiers',()=>{
  const regexText=sql.match(/raw_selection ~\* '([^']+)'/);
  assert.ok(regexText,'Review query must classify UUIDs with explicit regex');
  const uuid=new RegExp(regexText[1],'i');
  assert.equal(uuid.test('37e6d079-d075-4ea0-8ab4-16a172f3dedb'),true);
  assert.equal(uuid.test('37e6d079-d075-4ea0-8ab4-16a172f3'),false);
  assert.equal(uuid.test('37e6d079-d075-4ea0-8ab4-16a172f3d'),false);
  assert.equal(uuid.test('37e6d079-d075-4ea0-8ab4-16a172f3dedb-x'),false);
  assert.equal(uuid.test('AA-BB-CC'),false);
});

test('review query supports unified staging with missing legacy column and filters only active followers',()=>{
  assert.match(sql,/to_jsonb\(r\)->>'rappresentante_europeo'/);
  assert.match(sql,/follower\.id=r\.user_id AND follower\.status='a'/);
  assert.match(sql,/m\.office_code='E'/);
  assert.match(sql,/pm\.status='ACTIVE'/);
  assert.match(sql,/WHERE pm\.user_id=g\.potential_uuid/);
  assert.match(sql,/UUID_NO_ACTIVE_EU_MANDATE/);
  assert.match(sql,/LEGACY_NON_UUID/);
});

test('review SQL is read only, contains no secret follower IDs, and NEVER auto-approves a link',()=>{
  const lines=sql.split('\n').filter(line=>!line.trimStart().startsWith('--')).join('\n');
  assert.doesNotMatch(lines,/\b(INSERT|UPDATE|DELETE|MERGE|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE|COPY)\b/i);
  assert.match(lines,/NULL::text AS institutional_mep_id_not_yet_verified/);
  assert.match(lines,/NULL::text AS official_profile_evidence_not_yet_verified/);
  assert.match(lines,/FALSE AS approved_for_vote_attribution/);
  assert.match(lines,/PENDING_INDEPENDENT_OFFICIAL_ID_REVIEW/);
  assert.doesNotMatch(lines,/SELECT\s+(?:r|follower)\.user_id\b/i);
  assert.doesNotMatch(lines,/u\.data_nascita|luogo_nascita|follower\.nome|follower\.cognome/i);
  assert.match(lines,/u\.id=g\.potential_uuid/);
  assert.doesNotMatch(lines,/u\.nome\s*=|u\.cognome\s*=/);
});
