'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { spawnSync } = require('node:child_process');

const cli = path.resolve(__dirname, '../scripts/audit-official-sex.js');
function example() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'demos-official-sex-'));
  const users = path.join(dir,'users.json');
  const official = path.join(dir,'official.json');
  const report = path.join(dir,'review.json');
  fs.writeFileSync(users,JSON.stringify([{
    id:'11111111-1111-4111-8111-111111111111',
    nome:'Andrea',cognome:'Rossi',data_nascita:'1980-01-05',
    account_type:'PERSON',ruolo:'P',sesso:null
  }]));
  fs.writeFileSync(official,JSON.stringify([{
    external_id:'senatore-1',
    nome:'Andrea',cognome:'Rossi',data_nascita:'1980-01-05',
    sesso:'M',source_url:'https://dati.senato.it/sito/home'
  }]));
  return { dir,users,official,report };
}

test('CLI standard output prints only counts and does not write an output file by default', () => {
  const d=example();
  try {
    const run=spawnSync(process.execPath,[cli,'--users='+d.users,'--official='+d.official],{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    assert.equal(fs.existsSync(d.report),false);
    assert.doesNotMatch(run.stdout,/Andrea|Rossi|11111111|1980-01-05/);
    const report=JSON.parse(run.stdout);
    assert.equal(report.writes_performed,0);
    assert.equal(report.review_required_count,1);
    assert.equal(report.output_file_created,false);
  } finally { fs.rmSync(d.dir,{recursive:true,force:true}); }
});

test('CLI exports a private, opt-in review report but never updates existing files', () => {
  const d=example();
  try {
    const args=[cli,'--users='+d.users,'--official='+d.official,'--out='+d.report];
    const run=spawnSync(process.execPath,args,{encoding:'utf8'});
    assert.equal(run.status,0,run.stderr);
    const report=JSON.parse(fs.readFileSync(d.report,'utf8'));
    assert.equal(report.mode,'READ_ONLY_REVIEW');
    assert.equal(report.review_required[0].review_status,'REQUIRES_MANUAL_VERIFICATION');
    assert.equal(report.review_required[0].cie_verified,false);
    if(process.platform!=='win32') assert.equal(fs.statSync(d.report).mode&0o777,0o600);

    const second=spawnSync(process.execPath,args,{encoding:'utf8'});
    assert.notEqual(second.status,0);
    assert.equal(JSON.parse(fs.readFileSync(d.report,'utf8')).review_required_count,1);
  } finally { fs.rmSync(d.dir,{recursive:true,force:true}); }
});
