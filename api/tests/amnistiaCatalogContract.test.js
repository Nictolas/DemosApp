'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const route = fs.readFileSync(path.join(__dirname, '..', 'routes', 'amnistia.js'), 'utf8');
const approvals = fs.readFileSync(path.join(__dirname, '..', 'routes', 'subject-proposals.js'), 'utf8');
const migration = fs.readFileSync(path.join(__dirname, '..', '..', '20261022_amnistia_catalogo_reati.sql'), 'utf8');
const catalog = require('../services/amnistiaCatalog');

test('Amnistia published catalog lives in versioned JSON, not in a SELECT * from the database', () => {
  assert.match(route, /mergePublishedAmnistie\(dynamicResult\.rows\)/);
  assert.match(route, /getStaticAmnistie\(\)/);
  assert.match(route, /catalogRevision: getAmnistiaCatalogRevision\(\)/);
  assert.doesNotMatch(route, /SELECT \* FROM amnistia WHERE attiva = true/);
  assert.match(route, /WHERE attiva = true AND NOT/);
  assert.equal(catalog.getStaticAmnistie().length, 18);
  assert.equal(catalog.getStaticAmnistie().filter(entry => entry.attiva).length, 17);
  assert.equal(catalog.getAmnistiaCatalogRevision().length, 64);
  assert.equal(catalog.getStaticAmnistiaByName('Abuso d’ufficio').attiva, false);
});

test('Amnistia dynamic approvals stay database-backed and cannot duplicate static titles', () => {
  assert.match(approvals, /getStaticAmnistiaByName\(p\.title\)/);
  assert.match(approvals, /INSERT INTO amnistia\(legge,articolo,descrizione,fonte_url,attiva\)/);
  assert.match(approvals, /UPDATE amnistia SET attiva=FALSE/);
  assert.match(route, /router\.post\('\/', verifyToken, requireAdmin,/);
  assert.match(route, /resolveVoteTarget\(client, legge\)/);
  assert.match(route, /DELETE FROM voti_amnistia WHERE userid = \$1 AND legge = \$2/);
  assert.match(route, /INSERT INTO voti_amnistia \(userid, amnistia_id, legge\)/);
  assert.doesNotMatch(migration, /DELETE FROM public\.voti_amnistia/i);
});

test('Historic initial catalog still has ten sourced items and no votes are seeded', () => {
  assert.equal((migration.match(/\(non vigente\)/g) || []).length, 7);
  assert.match(migration, /Ricettazione di particolare tenuità/);
  assert.match(migration, /Blocco stradale durante manifestazioni sindacali/);
  assert.doesNotMatch(migration, /INSERT INTO public\.voti_amnistia/i);
});
