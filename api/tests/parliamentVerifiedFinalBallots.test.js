'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseVerifiedFinalBallots } = require('../services/parliamentVerifiedFinalBallotsService');

const camera = { openpolis_id:'vs19_730_097', camera:'Camera', data_votazione:'2026-10-21' };
const senato = { openpolis_id:'19-469-3', camera:'Senato', data_votazione:'2026-10-28' };

function officialCameraHtml(status='Favorevole',duplicate=false) {
  const rows = Array.from({length:150},(_,i)=>
    '<tr><td>'+(duplicate?'IDENTICA PERSONA':'CANDIDATO NOMINATIVO '+i)+'</td><td>GRUPPO</td><td>'+status+'</td></tr>');
  return '<html><body><h1>Votazione finale nominale n.97</h1>' +
    '<div>del 21/10/2026 seduta n. 730</div>' +
    '<table><tr><th>Nominativo</th><th>Gruppo</th><th>Voto</th></tr>' +
    rows.join('')+'</table></body></html>';
}
function openpolisSenateHtml(status='Contrario') {
  const rows = Array.from({length:150},(_,i)=>
    '<tr><td>SENATORE NOMINATIVO '+i+'</td><td>'+status+'</td><td>GRUPPO</td><td>-</td></tr>');
  return '<html><body><h1>Senato Votazione n. 3 / Seduta n. 469 del 28/10/2026</h1>' +
    '<div>VOTO FINALE Approvata</div>' +
    '<table><tr><th>Senatore</th><th>Voto</th><th>Gruppo</th><th>Ribelle</th></tr>' +
    rows.join('')+'</table></body></html>';
}

test('the correct Camera final roll-call retains each official member vote', () => {
  const result = parseVerifiedFinalBallots(officialCameraHtml(),camera);
  assert.equal(result.source.type,'official');
  assert.equal(result.date,'2026-10-21');
  assert.equal(result.members.length,150);
  assert.equal(result.members[0].vote,'Favorevole');
});

test('Senate Openpolis vote records retain attribution to noninstitutional source', () => {
  const result = parseVerifiedFinalBallots(openpolisSenateHtml(),senato);
  assert.equal(result.source.type,'openpolis');
  assert.equal(result.members.length,150);
  assert.equal(result.members[0].vote,'Contrario');
});

test('a mismatched vote ID, legislative chamber or vote date never produces attributed data', () => {
  assert.throws(() => parseVerifiedFinalBallots(officialCameraHtml(),{...camera,openpolis_id:'vs19_730_098'}),/VOTE_SOURCE_ID_MISMATCH/);
  assert.throws(() => parseVerifiedFinalBallots(officialCameraHtml(),{...camera,data_votazione:'2026-10-28'}),/VOTE_SOURCE_DATE_MISMATCH/);
  assert.throws(() => parseVerifiedFinalBallots(officialCameraHtml(),{...camera,camera:'Senato'}),/VOTE_SOURCE_CHAMBER_MISMATCH/);
  assert.throws(() => parseVerifiedFinalBallots(openpolisSenateHtml(),{...senato,openpolis_id:'19-468-4'}),/VOTE_SOURCE_ID_MISMATCH/);
});

test('secret final ballots never reveal inferred choices, even with synthetic nominal-looking rows', () => {
  const html = openpolisSenateHtml().replace('VOTO FINALE Approvata', 'VOTO FINALESEGRETO Approvata');
  assert.throws(() => parseVerifiedFinalBallots(html, senato), /VOTE_SOURCE_SECRET_BALLOT/);
  // This is a ballot-specific marker, not a generic filter legend elsewhere.
  const ordinary = openpolisSenateHtml().replace('</body>', '<aside>Filtro: VOTO FINALE SEGRETO</aside></body>');
  assert.equal(parseVerifiedFinalBallots(ordinary, senato).members.length, 150);
});

test('incomplete lists, duplicate names or unknown vote statuses fail closed', () => {
  assert.throws(() => parseVerifiedFinalBallots(officialCameraHtml('UNKNOWN'),camera),/VOTE_SOURCE_UNRECOGNIZED_ROW/);
  assert.throws(() => parseVerifiedFinalBallots(officialCameraHtml('Favorevole',true),camera),/VOTE_SOURCE_DUPLICATE_MEMBERS/);
  assert.throws(() => parseVerifiedFinalBallots('<html/>',camera),/VOTE_SOURCE_ID_MISMATCH/);
  assert.throws(() => parseVerifiedFinalBallots('',camera),/VOTE_SOURCE_INVALID_INPUT/);
});

test('only explicit final ballots are eligible in route; existing old nominal cache is not joined by title',()=>{
  const fs=require('node:fs'),p=require('node:path');
  const route=fs.readFileSync(p.join(__dirname,'../routes/voti-politici.js'),'utf8');
  const page=fs.readFileSync(p.join(__dirname,'../../client/src/pages/VotiPoliticiFinali.tsx'),'utf8');
  assert.match(route,/votazioni-finali-decisive\/:openpolisId\/voti-nominali/);
  assert.match(route,/WHERE openpolis_id = \$1 LIMIT 1/);
  assert.match(route,/res\.status\(503\)/);
  assert.match(page,/Vedi voti/);
  assert.match(page,/non il sito istituzionale del Senato/);
  assert.match(page,/Nessun voto viene attribuito/);
});
