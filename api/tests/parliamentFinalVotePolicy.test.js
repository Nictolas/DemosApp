'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { isConfirmedFinalParliamentVote: eligible } = require('../services/parliamentFinalVotePolicy');

test('only explicit final vote types qualify', () => {
  for (const title of [
    'Votazione finale del disegno di legge S. 61',
    'Voto finale sul complesso del provvedimento C. 123',
    'Approvazione definitiva del disegno di legge C. 2822-B',
    'Votazione conclusiva del disegno di legge 42',
    'Approvato definitivamente il disegno di legge 123'
  ]) assert.equal(eligible({ titolo_votazione: title }), true, title);
  assert.equal(eligible({titolo:'DDL 123', tipo_votazione:'Votazione finale'}), true);
});

test('article, amendment, order of day, confidence and procedural votes are excluded', () => {
  for (const title of [
    'ARTICOLO 62', 'ARTICOLO 18 - Votazione Articolo 18',
    'EM 13.1 - Votazione', 'Em. 20.3, Furlan e altri',
    'Articolo 1 - Votazione Articolo 1 DDL 1585',
    'ODG 9/2551/83 - Votazione Ordine del giorno',
    'RIS 6-137 - CPV DISP REST - Votazione Risoluzione',
    'Questione di fiducia sul ddl 111',
    'Votazione finale su emendamento 9.0.3',
    'Approvazione definitiva dell’articolo 3',
    'Coordinamento formale n. 1',
    'Voto su mozione di sfiducia',
    'Votazione sulla questione pregiudiziale'
  ]) assert.equal(eligible({ titolo_votazione: title }), false, title);
});

test('ambiguous titles, successful outcome or explanation do not imply finality', () => {
  for (const title of [
    'Separazione delle carriere dei magistrati',
    'Legge di delegazione europea 2022-2023',
    'Proposta di legge 123',
    'Votazione sul DDL 1718',
    'Decreto legge 112 approvato'
  ]) assert.equal(eligible({ titolo_votazione: title, esito: 'Approvato', spiegazione: 'Testo AI' }), false, title);
  assert.equal(eligible(null), false);
  assert.equal(eligible({}), false);
});

test('mixed final classification and procedural title fail closed', () => {
  assert.equal(eligible({ titolo_votazione: 'Votazione su emendamento 9.3', tipo_votazione: 'voto finale' }), false);
  assert.equal(eligible({ titolo_votazione: 'Voto finale', tipo_votazione: 'emendamento' }), false);
});
