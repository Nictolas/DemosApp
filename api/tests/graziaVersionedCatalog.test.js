'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const {
  getStaticGraziaEntries, getStaticGraziaByName,
  getGraziaCatalogRevision, mergeGraziaRanking, normalizeGraziaName, canonicalizeGraziaVotes,
  displayGraziaName, isHiddenGraziaName
} = require('../services/graziaCatalog');

test('Grazia JSON catalog versions only existing curated names, not votes or criminal records', () => {
  const list = getStaticGraziaEntries();
  assert.equal(list.length, 2);
  assert.deepEqual(list.map(x => x.id), [1, 2]);
  assert.deepEqual(list.map(x => Object.keys(x)), [
    ['id', 'nome', 'attivo'], ['id', 'nome', 'attivo']
  ]);
  assert.ok(list.every(x => typeof x.nome === 'string' && x.attivo));
  assert.equal(getGraziaCatalogRevision().length, 64);
  assert.ok(getStaticGraziaByName(list[0].nome.toLocaleUpperCase('it')));
  assert.equal(getStaticGraziaByName('Nome assente'), null);
  assert.equal(normalizeGraziaName(' Mario\u202fRossi '), 'mario rossi');
  assert.ok(Object.isFrozen(list) && Object.isFrozen(list[0]));
});

test('Grazia ranking combines curated names, approved DB names and legacy aggregates without phantom votes', () => {
  const dynamic = [{ id: 20, nome: 'Proposta approvata', attivo: true }];
  const votes = [{ nome: 'Proposta approvata', richieste: '2' }, { nome: 'Storico inserimento libero', richieste: '4' }];
  const ranking = mergeGraziaRanking(votes, dynamic);
  assert.equal(ranking.length, 4);
  assert.equal(ranking[0].nome, 'Storico inserimento libero');
  assert.equal(ranking[0].richieste, 4);
  assert.equal(ranking.find(x => x.nome === 'Proposta approvata').richieste, 2);
  assert.equal(ranking.filter(x => x.richieste === 0).length, 2);
  assert.deepEqual(votes, [{ nome: 'Proposta approvata', richieste: '2' }, { nome: 'Storico inserimento libero', richieste: '4' }]);
});

test('Grazia retains suppression and deduplicates whitespace or case without losing counts', () => {
  const [first] = getStaticGraziaEntries();
  const ranking = mergeGraziaRanking(
    [{ nome: first.nome, richieste: '7' }, { nome: 'MARIO ROSSI', richieste: '1' },
      { nome: 'Mario\u202fRossi', richieste: '2' }],
    [{ id: first.id, nome: first.nome, attivo: false },
      { id: 23, nome: 'Mario Rossi', attivo: true },
      { id: 24, nome: 'Nome ritirato', attivo: false }]
  );
  assert.equal(ranking.some(x => normalizeGraziaName(x.nome) === normalizeGraziaName(first.nome)), false);
  assert.equal(ranking.filter(x => x.nome === 'Mario Rossi').length, 1);
  assert.equal(ranking.find(x => x.nome === 'Mario Rossi').richieste, 3);
  assert.equal(ranking.some(x => x.nome === 'Nome ritirato'), false);
  assert.deepEqual(
    canonicalizeGraziaVotes(['MARIO ROSSI', first.nome, 'Voto storico non pubblicato'], ranking),
    ['Mario Rossi', first.nome, 'Voto storico non pubblicato']
  );
});

test('Grazia API keeps individual votes in Postgres and only publishes aggregated result data', () => {
  const route = read('api/routes/grazia.js');
  const reader = route.split("router.get('/', async (req, res) => {")[1]?.split('// GET /api/grazia/richieste')[0];
  assert.ok(reader);
  assert.match(reader, /COUNT\(\*\)::bigint AS richieste/);
  assert.match(reader, /FROM voti_grazia/);
  assert.match(reader, /FROM grazia_carcerati/);
  assert.match(reader, /mergeGraziaRanking\(votesResult\.rows, approvedResult\.rows\)/);
  assert.match(reader, /catalogRevision: getGraziaCatalogRevision\(\)/);
  assert.doesNotMatch(reader, /SELECT \*\s+FROM voti_grazia/);
  assert.match(route, /DELETE FROM voti_grazia/);
  assert.match(route, /INSERT INTO voti_grazia/);
  const migration = read('20261022_grazia_carcerati_catalogo.sql');
  assert.doesNotMatch(migration, /DELETE FROM public\.voti_grazia/i);
  assert.equal(read('api/catalog/grazia.json').includes('Storico inserimento libero'), false);
});

test('Grazia compact mobile view preserves vote controls and shows accurate explanatory subtitle', () => {
  const form = read('client/src/pages/Grazia/components/GraziaForm.tsx');
  const header = read('client/src/pages/Grazia/components/Header.tsx');
  const ranking = read('client/src/pages/Grazia/components/ClassificaCarcerati.tsx');
  assert.match(header, /La grazia condona o commuta la pena:<\/span>/);
  assert.match(header, /a chi la concederesti\?<\/span>/);
  assert.doesNotMatch(form, /Il tuo voto|<CardHeader|<Badge|Voti selezionati/);
  assert.match(form, /placeholder="Nome della persona\.\.\."/);
  assert.doesNotMatch(ranking, /Classifica carcerati|<CardHeader/);
  assert.match(form, /selectedVoti\.map/);
  assert.match(ranking, /onToggleSelezione/);
});


test('Roggero is displayed as Mario Roggero without altering historical votes, Rossi is absent from public ranking', () => {
  const votes = [
    { nome: 'Roggero', richieste: '1' },
    { nome: 'Mario Roggero', richieste: '2' },
    { nome: 'Rossi', richieste: '1' }
  ];
  const ranking = mergeGraziaRanking(votes, []);
  assert.equal(ranking.filter(row => row.nome === 'Mario Roggero').length, 1);
  assert.equal(ranking.find(row => row.nome === 'Mario Roggero').richieste, 3);
  assert.equal(ranking.some(row => normalizeGraziaName(row.nome) === 'roggero'), false);
  assert.equal(ranking.some(row => normalizeGraziaName(row.nome) === 'rossi'), false);
  assert.equal(displayGraziaName('  ROGGERO '), 'Mario Roggero');
  assert.equal(isHiddenGraziaName(' ROSSI '), true);
  assert.equal(isHiddenGraziaName('Mario Rossi'), false);
  assert.deepEqual(canonicalizeGraziaVotes(['Roggero', 'Rossi'], ranking), ['Mario Roggero', 'Rossi']);
  assert.deepEqual(votes, [
    { nome: 'Roggero', richieste: '1' },
    { nome: 'Mario Roggero', richieste: '2' },
    { nome: 'Rossi', richieste: '1' }
  ]);
  const route = read('api/routes/grazia.js');
  assert.match(route, /requestedVotes\.some\(isHiddenGraziaName\)/);
  assert.match(route, /displayGraziaName\(String\(nome\)\.trim\(\)\)/);
  assert.match(route, /canonicalizeGraziaVotes\(mieiVoti, classifica\)/);
});
