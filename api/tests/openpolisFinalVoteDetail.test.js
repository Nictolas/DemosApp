'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { parseOpenpolisFinalVoteDetail, ID_PATTERN } = require('../services/openpolisFinalVoteDetailService');

function fixture({ secret = false, camera = 'Camera', status = 'Favorevole' } = {}) {
  return `<!doctype html><html><body><header>Cerca un parlamentare</header>
  <h3>${camera}</h3><p>Votazione n. 17 / Seduta n. 735 del 28/10/2026</p>
  <h4>DDL 2700-A - VOTO FINALE</h4>
  <span>${secret ? 'VOTO FINALE SEGRETO' : 'VOTO FINALE'}</span>
  <span>259 Presenti</span><span>256 Votanti</span><span>129 Maggioranza</span>
  <h2>Come hanno votato i gruppi</h2>
  <table><tr><th>Gruppo</th><th>Voto</th><th>Indice di compattezza</th></tr>
    <tr><td>FDI</td><td>Favorevole</td><td>61,5%</td></tr></table>
  <h2>Come hanno votato i deputati</h2>
  <table><thead><tr><th>Deputato</th><th>Voto</th><th>Gruppo</th></tr></thead>
    <tbody>
      <tr><td><a href="/persone/aiello-davide-1985-01-01">Aiello Davide</a></td><td>${status}</td><td>M5S</td></tr>
      <tr><td>Albano Lucia</td><td>In missione</td><td>FDI</td></tr>
      <tr><td>Alifano Enrica</td><td>Contrario</td><td>M5S</td></tr>
      <tr><td>Almici Cristina</td><td>Assente</td><td>FDI</td></tr>
    </tbody>
  </table></body></html>`;
}

test('parse only verified nominal rows, never aggregate party votes', () => {
  const result = parseOpenpolisFinalVoteDetail(fixture(), 'Camera');
  assert.equal(result.camera, 'Camera');
  assert.equal(result.data_votazione, '2026-10-28');
  assert.equal(result.voto_segreto, false);
  assert.equal(result.riepilogo.presenti, 259);
  assert.equal(result.voti_nominali.length, 4);
  assert.deepEqual(result.voti_nominali.map(v => v.voto), ['Favorevole', 'In missione', 'Contrario', 'Assente']);
  assert.equal(result.voti_nominali[0].url_profilo, 'https://parlamento19.openpolis.it/persone/aiello-davide-1985-01-01');
  assert.equal(result.voti_nominali.some(v => v.nome === 'FDI'), false);
});

test('secret ballot is participation, not attributed choice', () => {
  const secret = fixture({ secret: true, status: 'Votante in voto segreto' }).replace('Alifano Enrica</td><td>Contrario', 'Alifano Enrica</td><td>Votante in voto segreto');
  const result = parseOpenpolisFinalVoteDetail(secret, 'Camera');
  assert.equal(result.voto_segreto, true);
  assert.equal(result.voti_nominali[0].voto, 'Votante in voto segreto');
  assert.equal(result.voti_nominali[2].voto, 'Votante in voto segreto');
  assert.throws(() => parseOpenpolisFinalVoteDetail(fixture({ secret: true }), 'Camera'), /OPENPOLIS_SECRET_VOTE_CONFLICT/);
});

test('fail closed for mismatched chamber, no nominal table and unknown statuses', () => {
  assert.throws(() => parseOpenpolisFinalVoteDetail(fixture(), 'Senato'), /OPENPOLIS_DETAIL_CHAMBER_MISMATCH/);
  assert.throws(() => parseOpenpolisFinalVoteDetail(fixture().replace(/<table>/g, '<section>').replace(/<\/table>/g, '</section>')), /OPENPOLIS_DETAIL_NOMINAL_EMPTY/);
  const result = parseOpenpolisFinalVoteDetail(fixture({ status: 'Favorevole secondo il partito' }), 'Camera');
  assert.equal(result.voti_nominali.some(v => v.nome === 'Aiello Davide'), false);
});

test('strict IDs prevent arbitrary URL fetching', () => {
  assert.ok(ID_PATTERN.test('vs19_735_017'));
  assert.ok(ID_PATTERN.test('19-468-4'));
  assert.equal(ID_PATTERN.test('https://evil.invalid/?foo=1'), false);
  assert.equal(ID_PATTERN.test('../etc/passwd'), false);
});
