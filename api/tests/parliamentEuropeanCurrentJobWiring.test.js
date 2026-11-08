'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');

const source=fs.readFileSync(path.join(__dirname,'../jobs/openpolisVotazioniFinaliJob.js'),'utf8');

test('EP importer shares the existing scheduled job and defaults OFF',()=>{
  const block=source.match(/if \(process\.env\.PARLIAMENT_EP_CURRENT_REFRESH_ENABLED === 'true'\) \{([\s\S]*?)\n    \}/);
  assert.ok(block,'explicit opt-in before any EP importer require or call');
  assert.match(block[1],/require\('\.\.\/services\/europeanParliamentSelectedCurrentVoteRefresh'\)/);
  assert.match(block[1],/await refreshSelectedEuropeanCurrentVote\(pool\)/);
  assert.ok(source.indexOf("PARLIAMENT_EP_CURRENT_REFRESH_ENABLED")<
    source.indexOf("require('../services/europeanParliamentSelectedCurrentVoteRefresh')"));
  assert.match(source,/} finally \{[\s\S]*?if \(pool\) \{[\s\S]*?PARLIAMENT_EP_CURRENT_REFRESH_ENABLED/,
    'EU refresh must run even when the Italian ballot source fails');
  assert.equal((source.match(/cron\.schedule\(/g)||[]).length,1,'reuse cron, do not create a second job');
  assert.match(source,/const openpolisVotazioniFinaliCron = process\.env\.OPENPOLIS_VOTAZIONI_FINALI_CRON/);
  const executable=block[1].split('\n').filter(line=>!line.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(executable,/pe:|DELETE FROM|TRUNCATE|sendFinalBallotPush/);
});
