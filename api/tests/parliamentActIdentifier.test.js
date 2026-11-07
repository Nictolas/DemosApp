'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { estraiNumeroLegge, canSearchItalianBills, canSearchActTitle, estraiTipoAtto } = require('../services/parliamentActIdentifier');

const file = fs.readFileSync(path.join(__dirname, '..', 'services', 'leggeAnalysisService.js'), 'utf8');

test('act classification uses whole terms, not EM buried inside ordinary Italian words', () => {
  for (const name of [
    'Sistema nazionale dei servizi',
    'Il tema delle infrastrutture',
    'La tutela dei sistemi pubblici',
    'S. 61 – voto finale'
  ]) assert.equal(estraiTipoAtto(name), null, name);
  assert.equal(estraiTipoAtto('Emendamento 1.0.6 (Turco e altri)'), 'Emendamento');
  assert.equal(estraiTipoAtto('Emendamenti congiunti 2.213 e 2.214'), 'Emendamento');
  assert.equal(estraiTipoAtto('EM 9.0.3 (Cataldi e altri)'), 'EM');
  assert.equal(estraiTipoAtto('DDL 123 – voto finale'), 'DDL');
  assert.equal(estraiTipoAtto('Disegno di legge n. 61'), 'Disegno di legge');
  assert.equal(estraiTipoAtto('Proposta di legge C. 2822-B'), 'Proposta di legge');
  assert.equal(estraiTipoAtto('Decreto-legge 154/2026'), 'Decreto');
  assert.equal(estraiTipoAtto('Mozione n. 567'), 'Mozione');
  assert.equal(estraiTipoAtto('Ordine del giorno n. 11'), 'ODG');
  assert.equal(estraiTipoAtto(123), null);
});

test('explicitly numbered bills may be looked up by matching parliamentary identifier', () => {
  assert.equal(estraiNumeroLegge('Disegno di legge n. 1718. Votazione questione fiducia'), '1718');
  assert.equal(estraiNumeroLegge('DDL 1234'), '1234');
  assert.equal(estraiNumeroLegge('S. 61 - votazione finale'), '61');
  assert.equal(estraiNumeroLegge('C. 2822-B - fiducia'), '2822');
  assert.equal(estraiNumeroLegge('2026 - Atto Camera n. 501'), '501');
  assert.equal(canSearchItalianBills('501', 'Camera'), true);
  assert.equal(canSearchItalianBills('61', 'Senato'), true);
});

test('dates, motions, amendments and decrees are never silently interpreted as bill identifiers', () => {
  for (const title of [
    '2026 - Mozione n. 567',
    'Decreto legge n. 175/2025',
    'Emendamento 9.0.3 sulla fiscalità',
    '2025/11/21 votazione di fiducia',
    'Votazione n. 1718',
    'Legge n. 1718',
    'Ordine del giorno 9/2750/178',
    '',
  ]) {
    assert.equal(estraiNumeroLegge(title), null, title);
  }
});

test('European Parliament and non-numeric IDs must not search Italian bills', () => {
  assert.equal(canSearchItalianBills('1718', 'Parlamento europeo'), false);
  assert.equal(canSearchItalianBills('1718', null), false);
  assert.equal(canSearchItalianBills('1718/2025', 'Senato'), false);
  assert.equal(canSearchItalianBills('../1718', 'Senato'), false);
  assert.equal(canSearchItalianBills('', 'Senato'), false);
});

test('chamber-labelled acts cannot cross-match an identically numbered bill in the other chamber', () => {
  assert.equal(canSearchActTitle('61', 'S. 61 — voto finale', 'Senato'), true);
  assert.equal(canSearchActTitle('61', 'S. 61 — voto finale', 'Camera'), false);
  assert.equal(canSearchActTitle('2822', 'C. 2822-B — fiducia', 'Camera'), true);
  assert.equal(canSearchActTitle('2822', 'C. 2822-B — fiducia', 'Senato'), false);
  assert.equal(canSearchActTitle('61', 'S. 61', 'Parlamento europeo'), false);
  assert.equal(canSearchActTitle('61', 'DDL 61', 'Senato'), true);
});

test('AI law source discovery must never attach hardcoded decree 175/2025 to DDL 1718', () => {
  assert.match(file, /canSearchActTitle\(numeroLegge, titolo, camera\)/);
  assert.doesNotMatch(file, /numeroLegge\s*===\s*['"]1718['"]/);
  assert.doesNotMatch(file, /DL1752025|21G00217|decreto\.legge:2025-11-21;175/);
  assert.match(file, /estraiNumeroLegge/);
  assert.doesNotMatch(file, /urlOpenpolis|Descrizione da Openpolis:/);
});
