'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../services/privacyDataExportService.js'),'utf8');

test('GDPR export includes CIE verification metadata but no HMAC person key',()=>{
  const begin=source.indexOf('async function getIdentityVerificationSummary(userId)');
  const end=source.indexOf('async function getProfile(userId)',begin);
  assert.ok(begin>=0 && end>begin);
  const method=source.slice(begin,end);
  assert.match(method,/getColumns\('identity_verifications'\)/);
  assert.match(method,/columns\.includes\('user_id'\)/);
  for(const column of ['provider','status','verified_at','detached_at','retention_until']){
    assert.match(method,new RegExp("'"+column+"'"));
  }
  assert.doesNotMatch(method,/person_key|fiscal_number|fiscalNumber|SELECT \*/);
  assert.match(method,/WHERE user_id::text = \$1/);
  assert.match(method,/LIMIT 1/);
  assert.match(source,/identity_verification: identityVerification/);
  assert.match(source,/getIdentityVerificationSummary\(userId\)/);
  assert.doesNotMatch(source,/sesso_fonte/);
});
