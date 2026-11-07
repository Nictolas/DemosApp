'use strict';
// No network, passwords are fictitious and never logged.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {assertAllowedPreflightTarget}=require('../scripts/check-proposals-schema-readiness');

const staging='fkeayjzvtuvzesljhjbc';
const direct='db.'+staging+'.supabase.co';
const pool='aws-1-eu-central-1.pooler.supabase.com';
const pass='dummy-not-real';

test('only project-identified staging direct and session-pooler targets are accepted',()=>{
  const cases=[
    ['postgresql://postgres:'+pass+'@'+direct+':5432/postgres?sslmode=require','staging-direct'],
    ['postgres://postgres.'+staging+':'+pass+'@'+pool+':5432/postgres?sslmode=require','staging-session-pooler'],
    ['postgres://postgres.'+staging+':'+pass+'@'+pool+':5432/postgres?sslmode=verify-full&sslrootcert=%2Ftmp%2Fca.crt','staging-session-pooler'],
    ['postgres://demos_ci@127.0.0.1:5433/demos_civic_ci','local'],
  ];
  for(const [url,mode] of cases){
    assert.equal(assertAllowedPreflightTarget(url).mode,mode);
  }
});

test('production and other projects cannot be selected through a shared host',()=>{
  const rejected=[
    'postgres://postgres.wxnblcqoyjqxktwkcqok:'+pass+'@'+pool+':5432/postgres?sslmode=require',
    'postgres://postgres:'+pass+'@db.wxnblcqoyjqxktwkcqok.supabase.co:5432/postgres?sslmode=require',
    'postgres://postgres:'+pass+'@'+pool+':5432/postgres?sslmode=require',
    'postgres://postgres.'+staging+':'+pass+'@aws-0-eu-central-1.pooler.supabase.com:5432/postgres?sslmode=require',
    'postgres://postgres.'+staging+':'+pass+'@'+pool+'.attacker.invalid:5432/postgres?sslmode=require',
    'postgres://postgres.'+staging+':'+pass+'@'+pool+':6543/postgres?sslmode=require',
    'postgres://postgres.'+staging+':'+pass+'@'+pool+':5432/other?sslmode=require',
    'postgres://postgres.'+staging+'@'+pool+':5432/postgres?sslmode=require',
  ];
  for(const url of rejected) assert.throws(()=>assertAllowedPreflightTarget(url));
});

test('remote staging URLs must enforce TLS and reject connection override parameters',()=>{
  for(const suffix of [
    '', '?sslmode=disable','?sslmode=prefer','?sslmode=allow',
    '?sslmode=require&host=db.wxnblcqoyjqxktwkcqok.supabase.co',
    '?sslmode=require&options=-c%20search_path%3Dprivate',
    '?sslmode=require&sslmode=disable',
    '?sslmode=require&sslrootcert=%2Ftmp%2Ffake.pem'
  ]) {
    assert.throws(()=>assertAllowedPreflightTarget('postgres://postgres.'+staging+':'+pass+'@'+pool+':5432/postgres'+suffix));
  }
  assert.throws(()=>assertAllowedPreflightTarget('postgres://demos_ci@127.0.0.1:5433/demos_civic_ci?host=production'));
});

test('invalid URL errors do not reveal the supplied password',()=>{
  const secret='SYNTHETIC_SECRET_MUST_NOT_APPEAR';
  const supplied='postgres://postgres.'+staging+':'+secret+'@'+pool+':5432/postgres?sslmode=disable';
  assert.throws(()=>assertAllowedPreflightTarget(supplied),error=>{
    assert.ok(!error.message.includes(secret));
    return true;
  });
});

test('production requires explicit acknowledgement and read-only transaction',()=>{
  const fs=require('node:fs');
  const path=require('node:path');
  const script=fs.readFileSync(path.join(__dirname,'../scripts/check-proposals-schema-readiness.js'),'utf8');
  assert.match(script,/DEMO[S]?_PREFLIGHT_CONFIRM!=='staging-readonly'/);
  assert.match(script,/assertAllowedPreflightTarget\(raw\);/);
  assert.ok(script.indexOf('assertAllowedPreflightTarget(raw);')<script.indexOf('await db.connect();'));
  assert.match(script,/db\.query\('BEGIN READ ONLY'\)/);
  assert.match(script,/db\.query\('ROLLBACK'\)/);
});
