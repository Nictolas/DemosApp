'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { politicalVotingSubject } = require('../utils/politicalVotingSubject');

test('Senato e Camera: M/F certificati producono la formulazione corretta', () => {
  assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_parlamento', camera: 'Senato', sesso: 'M' }), 'Il senatore');
  assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_parlamento', camera: 'Senato della Repubblica', sesso: 'F' }), 'La senatrice');
  assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_parlamento', camera: 'Camera', sesso: 'M' }), 'Il deputato');
  assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_parlamento', camera: 'Camera dei Deputati', sesso: 'F' }), 'La deputata');
  assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_parlamento', camera: 'Parlamento', sesso: 'M' }), 'Il parlamentare');
  assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_parlamento', camera: 'Parlamento', sesso: 'F' }), 'La parlamentare');
});

test('Consiglio comunale: usa M/F canonici senza ricorrere al genere legacy', () => {
  assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_comune', camera: 'qualsiasi', sesso: 'F' }), 'La consigliera comunale');
  assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_comune', camera: 'qualsiasi', sesso: 'M' }), 'Il consigliere comunale');
});

test('Se manca sesso CIE, il titolo resta neutro e non attribuisce maschile di default', () => {
  for (const unknown of [undefined, null, '', 'a', 'u', 'd', 'male', 'female', '0', '1']) {
    assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_parlamento', camera: 'Senato', sesso: unknown }), 'In Senato,');
    assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_parlamento', camera: 'Camera', sesso: unknown }), 'Alla Camera,');
    assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_parlamento', camera: 'Parlamento', sesso: unknown }), 'In Parlamento,');
    assert.equal(politicalVotingSubject({ tipoNotifica: 'voto_comune', sesso: unknown }), 'Nel consiglio comunale,');
  }
});

test('Le notifiche leggono solo sesso e non espongono genere politico', () => {
  const route = fs.readFileSync(path.resolve(__dirname, '../routes/notifiche.js'), 'utf8');
  assert.doesNotMatch(route, /politico_genere|u\.genere|subject\.genere|politico\.genere/);
  assert.match(route, /u\.sesso as politico_sesso/);
  assert.match(route, /subject\.sesso AS politico_sesso/);
  assert.match(route, /politicalVotingSubject\(/);
  assert.match(route, /sesso: c\.politico_sesso/);
});
