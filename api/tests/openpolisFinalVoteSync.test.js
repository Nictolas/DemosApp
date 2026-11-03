'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseListaVotazioniFinali } = require('../services/openpolisVotazioniFinaliService');

const html = [
'<html><body><nav><a href="/votazioni?main_vote_type=is_final">Voto finale</a></nav>',
'<div class="vote-list">',
'<article><p>Camera Votazione n. 17 Seduta n. 735 del 28/10/2026 </p>',
'<h3>DDL 2700-A - VOTO FINALE - Votazione finale </h3>',
'<a href="/votazioni/vs19_735_017">Apri dettaglio</a>',
'<span> VOTAZIONE FINALE Approvata 14 voti di scarto </span></article>',
'<article><p>Senato Votazione n. 4 Seduta n. 468 del 27/10/2026 </p>',
'<h3>Giovani e servizio civile universale - Votazione finale </h3>',
'<a href="/votazioni/19-468-4">Dettaglio voto</a>',
'<span> VOTAZIONE FINALE Respinta </span></article>',
'<article><p>Camera Votazione n. 55 Seduta n. 730 del 21/10/2026 </p>',
'<h3>DDL 3076 - Votazione finale </h3>',
'<a href="https://parlamento19.openpolis.it/votazioni/vs19_730_055">Dettaglio</a>',
'<span> VOTAZIONE FINALE Approvata </span></article>',
'<article><p>Camera Votazione n. 34 Seduta n. 722 del 07/10/2026</p>',
'<a href="/votazioni/vs19_722_034">Fiducia</a><span> FIDUCIA Approvata </span></article>',
'<a href="https://untrusted.invalid/votazioni/19-469-3">Senato voto finale Approvata</a>',
'</div></body></html>'
].join('\n');

test('parse final vote cards when chamber/date/status are siblings of link', () => {
  const items = parseListaVotazioniFinali(html);
  assert.equal(items.length, 3);
  assert.deepEqual(items.map(x => x.openpolis_id), ['vs19_735_017','19-468-4','vs19_730_055']);
  assert.deepEqual(items.map(x => x.camera), ['Camera','Senato','Camera']);
  assert.deepEqual(items.map(x => x.data_votazione), ['2026-10-28','2026-10-27','2026-10-21']);
  assert.deepEqual(items.map(x => x.esito), ['Approvata','Respinta','Approvata']);
  assert.ok(items.every(x => x.titolo && !x.titolo.startsWith('Votazione finale ')));
});

test('never treat confidence votes, third-party pages or sitewide filter links as final', () => {
  const items = parseListaVotazioniFinali(html);
  assert.equal(items.some(x => x.openpolis_id === 'vs19_722_034'), false);
  assert.equal(items.some(x => x.openpolis_id === '19-469-3'), false);
  assert.ok(items.every(x => x.url_dettaglio.startsWith('https://parlamento19.openpolis.it/votazioni/')));
});

test('do not infer a final vote from another card or the container', () => {
  const mixed = '<main><section>Camera Seduta n. 735 del 28/10/2026 VOTAZIONE FINALE Approvata</section>' +
    '<div><a href="/votazioni/vs19_735_001">Emendamento</a></div>' +
    '<div><a href="/votazioni/vs19_735_002">Ordine del giorno</a></div></main>';
  assert.deepEqual(parseListaVotazioniFinali(mixed), []);
});

test('empty or invalid upstream HTML must not silently count as new final votes', () => {
  assert.deepEqual(parseListaVotazioniFinali(''), []);
  const route = fs.readFileSync(path.join(__dirname, '../routes/voti-politici.js'), 'utf8');
  const job = fs.readFileSync(path.join(__dirname, '../jobs/openpolisVotazioniFinaliJob.js'), 'utf8');
  assert.match(route, /res\.status\(502\)\.json/);
  assert.match(route, /sync\.added/);
  assert.match(job, /OPENPOLIS_FINAL_VOTES_PARSE_EMPTY/);
  assert.match(job, /success: false/);
  const ui = fs.readFileSync(path.join(__dirname, '../../client/src/pages/VotiPoliticiFinali.tsx'), 'utf8');
  assert.match(ui, /nessuna nuova votazione finale/i);
  assert.match(ui, /Impossibile sincronizzare Openpolis/);
});
