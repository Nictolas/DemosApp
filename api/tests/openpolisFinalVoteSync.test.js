'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { parseListaVotazioniFinali, fetchVotazioniFinaliPerCamera } = require('../services/openpolisVotazioniFinaliService');

const html = [
'<html><body><nav><a href="/votazioni?main_vote_type=is_final">Voto finale</a></nav>',
'<div class="vote-list">',
'<article><p>CameraVotazione n. 17 Seduta n. 735 del 28/10/2026 </p>',
'<h3>DDL 2700-A - VOTO FINALE - Votazione finale </h3>',
'<a href="/votazioni/vs19_735_017">Apri dettaglio</a>',
'<span> VOTAZIONE FINALEApprovata 14 voti di scarto </span></article>',
'<article><p>SenatoVotazione n. 4 Seduta n. 468 del 27/10/2026 </p>',
'<h3>Giovani e servizio civile universale - Votazione finale </h3>',
'<a href="/votazioni/19-468-4">Dettaglio voto</a>',
'<span> VOTAZIONE FINALERespinta </span></article>',
'<article><p>CameraVotazione n. 55 Seduta n. 730 del 21/10/2026 </p>',
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

function syntheticPage(cards) {
  return '<html><body><div class="vote-list">' + cards.map(({ chamber, id, n }) =>
    '<article><p>' + chamber + 'Votazione n. ' + n +
    ' Seduta n. 735 del 28/10/2026 </p>' +
    '<h3>Votazione finale sintetica ' + n + ' - Votazione finale </h3>' +
    '<a href="/votazioni/' + id + '">Dettaglio</a>' +
    '<span>VOTAZIONE FINALEApprovata</span></article>'
  ).join('') + '</div></body></html>';
}

test('independent chamber quota: Senate is imported despite surplus Camera final ballots', async () => {
  const camera = n => ({chamber:'Camera',id:'vs19_735_'+n,n});
  const senate = n => ({chamber:'Senato',id:'19-469-'+n,n});
  const pages = [
    syntheticPage([camera(1),camera(2),camera(3),camera(4)]),
    syntheticPage([camera(5),camera(6),camera(7)]),
    syntheticPage([senate(3),senate(4)])
  ];
  let calls=0;
  const items=await fetchVotazioniFinaliPerCamera(3,{
    fetchPage:async page=>{calls++;return pages[page-1]||syntheticPage([])}
  });
  assert.equal(calls,4);
  assert.equal(items.filter(v=>v.camera==='Camera').length,3);
  assert.equal(items.filter(v=>v.camera==='Senato').length,2);
  assert.deepEqual(items.filter(v=>v.camera==='Senato').map(v=>v.openpolis_id),['19-469-3','19-469-4']);
  assert.equal(new Set(items.map(v=>v.openpolis_id)).size,items.length);
});

test('balanced importer stops on repeated pages and fails closed on empty first page', async () => {
  const page=syntheticPage([{chamber:'Camera',id:'vs19_735_1',n:1}]);
  let calls=0;
  const items=await fetchVotazioniFinaliPerCamera(3,{fetchPage:async()=>{calls++;return page;}});
  assert.equal(calls,2);
  assert.equal(items.length,1);
  await assert.rejects(fetchVotazioniFinaliPerCamera(3,{fetchPage:async()=>syntheticPage([])}),
    /OPENPOLIS_FINAL_VOTES_PARSE_EMPTY/);
});

test('authenticated final-vote feed is read-only, with a fail-closed empty cache', () => {
  const route = fs.readFileSync(path.join(__dirname, '../routes/voti-politici.js'), 'utf8');
  const start = route.indexOf("router.get('/votazioni-finali-decisive', verifyToken");
  const end = route.indexOf("router.post('/sync-votazioni-finali-decisive'", start);
  assert.ok(start >= 0 && end > start, 'feed and Admin sync routes must be distinct');
  const feed = route.slice(start, end);
  assert.match(feed, /loadOpenpolisVotazioniFinali\(pool, limit\)/);
  assert.match(feed, /rows\.length === 0/);
  assert.match(feed, /res\.status\(503\)\.json/);
  assert.doesNotMatch(feed, /fetchVotazioniFinaliDecisive|saveOpenpolisVotazioniFinaliToDb|INSERT INTO|UPDATE /,
    'authenticated GET must never fetch and persist upstream source data');
  const sync = route.slice(end, route.indexOf("router.get('/ultime'", end));
  assert.match(sync, /requireAdmin/);
  assert.match(sync, /runOpenpolisVotazioniFinaliSync\(\)/);
});

test('legacy vote detail cannot persist parliamentary nominal-vote history on GET', () => {
  const route = fs.readFileSync(path.join(__dirname, '../routes/voti-politici.js'), 'utf8');
  const detailStart = route.indexOf("router.get('/dettagli/:uri', verifyToken");
  assert.ok(detailStart >= 0, 'the legacy detail endpoint must remain available');
  const detailRoute = route.slice(detailStart);
  assert.doesNotMatch(detailRoute, /await saveVotiNominaliToCache\s*\(/,
    'viewing a parliamentary detail must not append nominal vote snapshots');
  assert.match(detailRoute, /PROD-041: non leggere la cache nominale storica/,
    'document policy: nominal-vote history must never be read by GET');
  assert.doesNotMatch(route, /async function saveVotiNominaliToCache\s*\(/,
    'remove dead legacy writer, not just its current invocation');
  assert.doesNotMatch(route, /async function creaNotificheParlamentoDaVotiNominali\s*\(/,
    'retroactive notifications must not be generated from old nominal cache');
  assert.doesNotMatch(route, /INSERT INTO parlamento_voti_nominali/,
    'no historical nominal inserts should exist in the legacy routes');
  assert.doesNotMatch(route, /queryWithAccountModelFallback/,
    'unused account-query fallback was solely a dependency of legacy notification writer');
});

test('scheduled sync uses balanced source importer, not a global 50-ballot quota', () => {
  const job=fs.readFileSync(path.join(__dirname,'../jobs/openpolisVotazioniFinaliJob.js'),'utf8');
  assert.match(job,/fetchVotazioniFinaliPerCamera\(50\)/);
  assert.doesNotMatch(job,/fetchVotazioniFinaliDecisive\(50\)/);
});
