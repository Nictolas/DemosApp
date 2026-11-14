'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {selectNextOfficialReferendum} = require('../utils/selectNextOfficialReferendum');

test('next official referendum selects the nearest deadline and preserves inputs', () => {
  const source = [
    {id:'later',dataFine:'2027-08-01',firme:200},
    {id:'soon',dataFine:'2026-12-01',firme:8},
    {id:'undated',dataFine:null,firme:9000},
  ];
  const before = JSON.stringify(source);
  assert.equal(selectNextOfficialReferendum(source).id,'soon');
  assert.equal(JSON.stringify(source),before);
});
test('next official referendum ranks undated and legacy 9999 sentinel last', () => {
  const result = selectNextOfficialReferendum([
    {id:'sentinel',data_fine:'9999-12-31',firme:3000},
    {id:'none',data_fine:null,firme:2000},
    {id:'dated',data_fine:'2027-11-10',firme:1},
  ]);
  assert.equal(result.id,'dated');
});
test('next official referendum breaks tied deadlines by signatures then stable identifier', () => {
  const items = [
    {id:'z',dataFine:'2027-02-20',firme:200},
    {id:'a',dataFine:'2027-02-20',firme:200},
    {id:'c',dataFine:'2027-02-20',firme:20},
  ];
  assert.equal(selectNextOfficialReferendum(items).id,'a');
});
test('next official referendum handles empty, invalid and no-date inputs', () => {
  assert.equal(selectNextOfficialReferendum([]),null);
  assert.equal(selectNextOfficialReferendum(null),null);
  assert.equal(selectNextOfficialReferendum([null]),null);
  assert.equal(selectNextOfficialReferendum([{id:'a',dataFine:null}]).id,'a');
});
test('real referendum voting remains mounted, but retired priority endpoints cannot write', () => {
  const route = fs.readFileSync(path.join(__dirname,'..','routes','referendum.js'),'utf8');
  assert.match(route,/router\.use\('\/vote-real', referendumVoteRoutes\)/);
  assert.match(route,/PRIORITA_REFERENDUM_DISMESSA/);
  assert.match(route,/router\.use\(\(req, res\) =>/);
  assert.doesNotMatch(route,/pool\.query|INSERT INTO|UPDATE referendum_abrogativi|DELETE FROM voti_referendum_abrogativi/);
});
test('next referendum widget uses only official ministry source without unsupported legacy columns', () => {
  const src = fs.readFileSync(path.join(__dirname,'..','routes','referendum-abrogativi.js'),'utf8');
  const begin = src.indexOf("router.get('/prossima', verifyToken, async (req, res) => {");
  const end = src.indexOf('module.exports = router;',begin);
  assert.ok(begin>=0 && end>begin);
  const code=src.slice(begin,end);
  assert.match(code,/buildQueryForTipo\('referendum', null, null, false, true\)/);
  assert.match(code,/selectNextOfficialReferendum/);
  assert.doesNotMatch(code,/FROM\s+referendum_abrogativi|firestore_id_backup|\b(?:row|r)\.(?:status|quorum)\b/i);
  assert.doesNotMatch(code,/details:\s*error\.message/);
});
