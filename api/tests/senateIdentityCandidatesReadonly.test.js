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
  assert.match(body,/QUARANTINED_CROSS_CHAMBER_LEGACY_DUPLICATE/);
  assert.match(body,/other_user\.data_nascita=u\.data_nascita/);
  assert.match(body,/other_m\.source='LEGACY_BACKFILL'/);
  assert.match(body,/own_m\.source='LEGACY_BACKFILL'/);
  assert.match(body,/lower\(follower\.status\)='a'/);
  assert.match(body,/ps\.selection_kind='representative'/);
  assert.match(body,/m\.status='ACTIVE'/);
  assert.match(body,/SELECT s\.political_office_id, s\.representative_id, u\.nome, u\.cognome/);
  assert.doesNotMatch(body,/SELECT\s+[^;]*ps\.user_id\s+AS\s+follower/i);
  assert.doesNotMatch(body,/ON CONFLICT|information_schema|pg_catalog/i);
});


test('official seven-person selected snapshot is reviewer-only, read-only and does not approve identity',()=>{
  const sql=fs.readFileSync(path.join(__dirname,
    '../database/20261108_selected_official_registry_audit_readonly.sql'),'utf8');
  const body=sql.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(body,/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY|CALL|DO|EXECUTE)\b/i);
  assert.match(body,/ps\.selection_kind='representative'/);
  assert.match(body,/lower\(follower\.status\)='a'/);
  assert.match(body,/m\.status='ACTIVE'/);
  assert.match(body,/NEEDS_NEW_OFFICIAL_REGISTRY_REVIEW/);
  assert.match(body,/OFFICE_MISMATCH_REVIEW/);
  assert.match(body,/DOB_MISMATCH_REVIEW/);
  assert.match(body,/PUBLIC_BIO_MATCH_NOT_ID_VERIFIED/);
  assert.match(body,/s\.demos_birth_date IS DISTINCT FROM r\.official_birth_date/);
  assert.doesNotMatch(body,/public\.institutional_nominal_identity_links|ON CONFLICT/i,
    'public biographical evidence cannot be used to approve identity links');
  // Regression: known day/month transpositions come from official sources,
  // not from the erroneous historical dates imported into DEMOS.
  for(const [name,dob] of [
    ['marco grimaldi','1980-11-08'],
    ['carlo calenda','1973-04-09'],
    ['matteo salvini','1973-03-09']
  ]){
    assert.match(body,new RegExp("'"+name+"'[^\\n]*DATE '"+dob+"'"));
  }
  // Public politician names + institutional page URLs only. No followers
  // or their identifying fields are projected to the reviewer report.
  assert.doesNotMatch(body,/SELECT\s+[^;]*ps\.user_id\s+AS\s+follower/i);
  assert.match(body,/SELECT selected_office,nome,cognome,representative_id,audit_status/);
});


test('selected-only existing senate official-ID candidate audit stays read-only and cannot approve links',()=>{
  const sql=fs.readFileSync(path.join(__dirname,
    '../database/20261108_selected_senate_official_id_candidates_readonly.sql'),'utf8');
  const body=sql.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.doesNotMatch(body,/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY|CALL|DO|EXECUTE)\b/i);
  assert.match(body,/ps\.political_office_id = 'it.senato'/);
  assert.match(body,/lower\(follower\.status\) = 'a'/);
  assert.match(body,/m\.office_code = 'S'/);
  assert.match(body,/v\.camera = 'Senato'/);
  assert.match(body,/COUNT\(DISTINCT official_senator_id\)/);
  assert.match(body,/AMBIGUOUS_SOURCE_PERSON_IDENTITIES/);
  assert.match(body,/UNVERIFIED_OFFICIAL_ID_CANDIDATE_REVIEW_NAME_DOB_AND_OFFICE/);
  assert.match(body,/NO_OFFICIAL_PERSON_ID_IN_EXISTING_CACHE/);
  assert.doesNotMatch(body,/institutional_nominal_identity_links|ON CONFLICT|pg_catalog/i);
  assert.doesNotMatch(body,/SELECT\s+[^;]*ps\.user_id\s+AS\s+follower/i);
});


test('secondary Openpolis slug discrepancy does not override the first-party official DOB',()=>{
  const sql=fs.readFileSync(path.join(__dirname,
    '../database/20261108_selected_first_party_vs_openpolis_dob_READONLY.sql'),'utf8');
  const body=sql.replace(/--[^\n]*/g,'').replace(/\/\*[\s\S]*?\*\//g,'');
  assert.match(body,/WITH reference\(/);
  assert.match(body,/JOIN public\.users follower ON follower\.id=ps\.user_id AND lower\(follower\.status\)='a'/);
  assert.match(body,/ps\.selection_kind='representative'/);
  assert.match(body,/public\.voti_camera/);
  assert.match(body,/COUNT\(DISTINCT v\.url_openpolis\)/);
  assert.match(body,/SECONDARY_SLUG_CONFLICTS_WITH_FIRST_PARTY/);
  assert.match(body,/FIRST_PARTY_BIO_MATCH_ONLY_ID_NOT_VERIFIED/);
  assert.match(body,/NEEDS_NEW_FIRST_PARTY_REGISTRY_REVIEW/);
  assert.match(body,/source_profile_count>1/);
  assert.doesNotMatch(body,/\b(?:INSERT|UPDATE|DELETE|MERGE|TRUNCATE|DROP|ALTER|CREATE|GRANT|REVOKE|COPY|CALL|DO|EXECUTE)\b/i);
  assert.doesNotMatch(body,/institutional_nominal_identity_links|ON CONFLICT/i);
  assert.doesNotMatch(body,/SELECT\s+[^;]*ps\.user_id\s+AS\s+follower/i);
  // Institution-backed Peppe DOB and erroneous secondary slug are different:
  // the review report is intentionally allowed to show the conflict.
  assert.match(body,/'peppe de cristofaro','it\.senato',DATE '1971-06-26'/);
  assert.doesNotMatch(body,/\bSET\s+data_nascita/i);
});
