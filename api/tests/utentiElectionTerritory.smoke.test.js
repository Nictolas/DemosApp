'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '../..');
const read = relative => fs.readFileSync(path.join(root, relative), 'utf8');

test('admin list reads residence independently of political mandates', () => {
  const route = read('api/routes/users/search.js');
  const list = route.slice(route.indexOf('// GET /api/users/ - '), route.indexOf('// GET /api/users/:userId'));
  assert.match(list, /LEFT JOIN user_profile up ON up.user_id = u.id/);
  assert.match(list, /TRIM\(up\.comune_residenza\).*u\.comune_residenza\) AS comune_residenza/);
  assert.match(list, /CASE WHEN location\.mandate_is_municipal THEN location\.mandate_municipality/);
  assert.match(list, /WHEN location\.has_active_mandate THEN NULL/);
  assert.match(list, /ELSE NULL END AS comune_elezione/);
  assert.match(list, /location\.mandate_region.*AS regione_elezione/);
  assert.match(list, /pm\.status = 'ACTIVE'/);
  assert.match(list, /pm\.office_code = 'CO'/);
  assert.match(list, /LIMIT 1/);
  assert.match(list, /ORDER BY pm\.starts_at DESC NULLS LAST, pm\.created_at DESC, pm\.id DESC/);
  assert.match(list, /FROM users u/);
  assert.match(list, /u\.nome ILIKE/);
  assert.match(list, /u\.cognome ILIKE/);
  assert.match(list, /u\.email ILIKE/);
  assert.match(list, /u\.ruolo =/);
  assert.match(list, /u\.status =/);
  assert.match(list, /pm\.starts_at IS NULL OR pm\.starts_at <= NOW\(\)/);
  assert.match(list, /pm\.ends_at IS NULL OR pm\.ends_at > NOW\(\)/);
  assert.match(list, /decompressUserLocation\(user\)/);
  assert.doesNotMatch(list, /location\.mandate_municipality.*AS comune_residenza/);
  assert.doesNotMatch(list, /WHERE \(nome ILIKE|WHERE status =|AND ruolo =/);
});

test('admin statistics keep residence and election-territory visualizations separate', () => {
  const page = read('client/src/pages/Utenti/index.tsx');
  assert.match(page, /const city = user\.comune_residenza \|\| 'N\/A'/);
  assert.match(page, /const region = user\.regione_residenza \|\| 'N\/A'/);
  assert.match(page, /const politicians = utenti\.filter\(user => user\.ruolo === 'P'\)/);
  assert.match(page, /const politiciansByElectionRegion = politicians\.reduce/);
  assert.match(page, /const politiciansByElectionMunicipality = politicians\.reduce/);
  assert.match(page, /region = user\.regione_elezione\.trim\(\)/);
  assert.match(page, /municipality = user\.comune_elezione\.trim\(\)/);
  assert.match(page, /Politici per regione di elezione/);
  assert.match(page, /Comuni indicati per l'elezione dei politici/);
  assert.match(page, /Residenza comunale disponibile per/);
  assert.match(page, /\.filter\(\(\[city\]\) => city !== 'N\/A'/);
  assert.doesNotMatch(page, /user\.comune_residenza\s*\|\|\s*user\.comune_elezione/);
});
