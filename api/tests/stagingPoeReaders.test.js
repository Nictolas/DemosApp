'use strict';

// Contract tests for the *historical* functional staging branch.
// This branch has different Sondaggi code from main: do not copy whole routes.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');
const {
 ACCOUNT_TYPES,ACCOUNT_TYPE_CODES,normalizeAccountType,
 normalizeNewModelRow,deriveLegacyRole,getAccountSubject
}=require('../services/accountCapabilitiesService');

test('compact and descriptive storage normalize to stable API values',()=>{
 const pairs=[
 ['P','PERSON'],['PERSON','PERSON'],
 ['O','ORGANIZATION'],['ORGANIZATION','ORGANIZATION'],
 ['E','INSTITUTION'],['INSTITUTION','INSTITUTION']
 ];
 for(const [value,expected] of pairs){
  assert.equal(normalizeAccountType(value),expected);
  const subject=normalizeNewModelRow({
   id:'synthetic',status:'a',account_type:value,is_admin:false,
   is_activist:false,is_candidate:false,is_politician:false
  });
  assert.equal(subject.capabilities.accountType,expected);
  assert.equal(subject.legacyRole,
    expected==='PERSON'?'E':expected==='ORGANIZATION'?'O':'I');
 }
 assert.equal(ACCOUNT_TYPE_CODES.PERSON,'P');
 assert.equal(ACCOUNT_TYPE_CODES.ORGANIZATION,'O');
 assert.equal(ACCOUNT_TYPE_CODES.INSTITUTION,'E');
 assert.equal(normalizeAccountType('INVALID'),null);
 assert.equal(deriveLegacyRole({accountType:'P',isPolitician:true,isCandidate:true}),'CP');
 assert.equal(deriveLegacyRole({accountType:'O',isAdmin:true}),'O');
 assert.equal(deriveLegacyRole({accountType:'E'}),'I');
});

test('real account-capability DB reader returns descriptive account type and preserves P/CP',async()=>{
 for(const type of ['P','PERSON']){
  const queries=[];
  const pool={async query(sql,params){
   queries.push({sql,params});
   return {rows:[{id:'synthetic',account_type:type,status:'a',
      is_admin:false,is_activist:false,is_candidate:true,is_politician:true}]};
  }};
  const subject=await getAccountSubject(pool,'synthetic');
  assert.equal(queries.length,1);
  assert.equal(subject.capabilities.accountType,'PERSON');
  assert.equal(subject.legacyRole,'CP');
 }
});

test('legacy staging Sondaggi and Opinioni queries include compact P without losing consent checks',()=>{
 for(const [file,total] of [['routes/sondaggi.js',4],['routes/opinioni/stats.js',6]]){
  const source=read(file);
  assert.equal((source.match(/u\.account_type IN \('PERSON', 'P'\)/g)||[]).length,total);
  assert.doesNotMatch(source,/u\.account_type\s*=\s*'PERSON'/);
  assert.ok((source.match(/political_opinions_consent/g)||[]).length>=total);
 }
 const organizations=read('routes/organizzazioni.js');
 assert.match(organizations,/account_type IN \('ORGANIZATION', 'O'\)/);
});

test('/auth/me does not reveal data after deactivation and never logs bearer token',()=>{
 const profile=read('routes/auth/profile.js');
 assert.match(profile,/Cache-Control', 'private, no-store, max-age=0'/);
 assert.match(profile,/accountSubject\.status !== 'a'/);
 assert.match(profile,/return res\.status\(401\)\.json/);
 assert.doesNotMatch(profile,/console\.log\([^;]*token\.substring/i);
});

test('staging bootstrap blocks accidental long account-type reset after compact cutover',()=>{
 const bootstrap=read('database/create-account-capabilities-model.sql');
 const guard=bootstrap.indexOf('DO $compact_guard$');
 const resettingDefault=bootstrap.indexOf("ALTER TABLE users ALTER COLUMN account_type SET DEFAULT 'PERSON'");
 assert.ok(guard>0&&guard<resettingDefault);
 assert.match(bootstrap,/Legacy account type bootstrap cannot run after compact P\/O\/E cutover/);
 assert.match(bootstrap,/pg_get_expr\(d\.adbin, d\.adrelid\)/);
});

test('existing staging seed guards prevent new PERSON literals after P/O/E cutover',()=>{
 const seed=read('scripts/stagingMigrate.js');
 assert.match(seed,/default must be PERSON or P/);
 assert.doesNotMatch(seed,/account_type='PERSON'/);
 assert.doesNotMatch(seed,/account_type = 'PERSON'/);
});
