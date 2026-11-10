'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  getStaticAmnistie, getStaticAmnistiaByName, mergePublishedAmnistie,
  normalizeAmnistiaName, resolveVoteTarget, AmnistiaCatalogConflict
} = require('../services/amnistiaCatalog');

test('versioned Amnistia records retain legacy IDs, stable names and no duplicate keys', () => {
  const entries = getStaticAmnistie();
  assert.deepEqual(entries.map(x => x.id).sort((a, b) => a - b), Array.from({ length: 18 }, (_, i) => i + 1));
  assert.equal(new Set(entries.map(x => normalizeAmnistiaName(x.legge))).size, entries.length);
  assert.equal(getStaticAmnistiaByName('  VENDITA, PRODUZIONE E DISTRIBUZIONE DI CANNABIS ILLEGALE  ').id, 1);
  assert.equal(getStaticAmnistiaByName('Reato inesistente'), null);
  assert.equal(getStaticAmnistiaByName('Abuso d’ufficio').attiva, false);
});

test('static text overrides stale database metadata; approved rows appear live; withdrawn rows stay hidden', () => {
  const original = getStaticAmnistiaByName('Eccesso colposo di legittima difesa');
  const dbRows = [
    { id: original.id, legge: original.legge, articolo: 'testo obsoleto', attiva: true },
    { id: 99, legge: 'Proposta approvata dal pannello Admin', articolo: 'Art. 100', descrizione: 'Esempio', attiva: true },
    { id: 100, legge: ' PROPOSTA APPROVATA DAL PANNELLO ADMIN ', attiva: true },
    { id: 101, legge: 'Proposta ritirata', attiva: false },
    { id: 3, legge: 'Abuso d’ufficio', attiva: true }
  ];
  const result = mergePublishedAmnistie(dbRows);
  assert.equal(result.length, 18);
  assert.equal(result.find(x => x.legge === original.legge).articolo, original.articolo);
  assert.equal(result.find(x => x.id === 99).descrizione, 'Esempio');
  assert.equal(result.some(x => x.legge === 'Proposta ritirata'), false);
  assert.equal(result.some(x => x.legge === 'Abuso d’ufficio'), false);
  assert.equal(dbRows[0].articolo, 'testo obsoleto');
  assert.equal(mergePublishedAmnistie([]).length, 17);
});

test('voting for existing catalog record preserves the legacy numeric amnistia_id', async () => {
  const queries = [];
  const fake = { query: async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith('SELECT id, legge, attiva')) {
      return { rows: [{ id: 1, legge: 'Vendita, produzione e distribuzione di cannabis illegale', attiva: true }] };
    }
    return { rows: [] };
  }};
  const target = await resolveVoteTarget(fake, 'Vendita, produzione e distribuzione di cannabis illegale');
  assert.equal(target.id, 1);
  assert.equal(queries.filter(q => q.sql.startsWith('INSERT')).length, 0);
  assert.equal(queries.filter(q => q.sql.includes('pg_advisory_xact_lock')).length, 1);
});

test('empty staging can materialize static vote reference without touching user votes', async () => {
  const queries = [];
  const fake = { query: async (sql, values) => {
    queries.push({ sql, values });
    if (sql.startsWith('SELECT id, legge, attiva')) return { rows: [] };
    if (sql.startsWith('INSERT INTO amnistia')) return { rows: [{ id: 101, legge: values[0], attiva: true }] };
    return { rows: [] };
  }};
  const target = await resolveVoteTarget(fake, 'Eccesso colposo di legittima difesa');
  assert.equal(target.id, 101);
  assert.equal(queries.filter(x => x.sql.startsWith('INSERT INTO amnistia')).length, 1);
  assert.equal(queries.some(x => x.sql.includes('voti_amnistia')), false);
});

test('withdrawn, unknown and inconsistent records do not get resurrected automatically', async () => {
  const disabled = await resolveVoteTarget({ query: () => { throw Error('should not query'); } }, 'Abuso d’ufficio');
  assert.equal(disabled, null);
  const notFound = await resolveVoteTarget({ query: async () => ({ rows: [] }) }, 'Titolo mai approvato');
  assert.equal(notFound, null);
  const inconsistent = { query: async (sql) => sql.startsWith('SELECT id, legge, attiva')
    ? { rows: [{ id: 8, legge: 'Eccesso colposo di legittima difesa', attiva: false }] }
    : { rows: [] } };
  await assert.rejects(resolveVoteTarget(inconsistent, 'Eccesso colposo di legittima difesa'), AmnistiaCatalogConflict);
});
