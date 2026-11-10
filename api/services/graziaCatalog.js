'use strict';

const { createHash } = require('node:crypto');

// Only the two already-curated public, name-only entries from the 20261022
// Grazia catalog migration are versioned here. Never copy a name from
// voti_grazia or private requests into permanent source code automatically.
// A name in this list does NOT assert an individual's current detention status.
const rows = require('../catalog/grazia.json');

const normalizeGraziaName = (value) => String(value || '')
  .normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('it');

// Correzioni editoriali della sola classifica: non cambiano il voto storico
// conservato in PostgreSQL e non creano nuovi soggetti nel catalogo verificato.
const publicAliases = new Map([['roggero', 'Mario Roggero']]);
const hiddenPublicNames = new Set(['rossi']);
const displayGraziaName = (name) => publicAliases.get(normalizeGraziaName(name)) || name;
const isHiddenGraziaName = (name) => hiddenPublicNames.has(normalizeGraziaName(name));

const publishedEntries = Object.freeze(rows.map(row => Object.freeze({
  id: row.id,
  nome: row.nome,
  attivo: row.attivo
})));
const byName = new Map(publishedEntries.map(item => [normalizeGraziaName(item.nome), item]));
const ids = new Set(publishedEntries.map(item => item.id));

if (byName.size !== publishedEntries.length || ids.size !== publishedEntries.length ||
    publishedEntries.some(item => !Number.isSafeInteger(item.id) || item.id <= 0 ||
      typeof item.nome !== 'string' || !item.nome.trim() ||
      typeof item.attivo !== 'boolean')) {
  throw new Error('Catalogo Grazia versionato non valido: ID e nomi devono essere univoci');
}

const revision = createHash('sha256').update(JSON.stringify(publishedEntries)).digest('hex');
function getStaticGraziaEntries() { return publishedEntries; }
function getGraziaCatalogRevision() { return revision; }
function getStaticGraziaByName(name) { return byName.get(normalizeGraziaName(name)) || null; }

// Maintain legacy aggregate vote-only entries for backwards compatibility.
// Do not make any assertion about their judicial status, and do not persist
// them in the permanent, versioned code catalog.
// An Admin deactivation in grazia_carcerati overrides the static catalog;
// this ensures the code never revives a deliberately suppressed name.
function mergeGraziaRanking(voteCounts = [], databaseEntries = []) {
  const suppressed = new Set([
    ...hiddenPublicNames,
    ...databaseEntries.filter(row => row && row.attivo === false)
      .map(row => normalizeGraziaName(displayGraziaName(row.nome)))
  ]);
  const all = new Map();

  function addName(nome, richieste = 0, useCanonical = false) {
    const originalKey = normalizeGraziaName(nome);
    const displayName = displayGraziaName(nome);
    const key = normalizeGraziaName(displayName);
    if (!key || suppressed.has(originalKey) || suppressed.has(key)) return;
    const staticEntry = byName.get(key);
    if (staticEntry && !staticEntry.attivo) return;
    const current = all.get(key);
    if (current) {
      if (useCanonical && !publicAliases.has(originalKey) && !byName.has(key)) current.nome = displayName;
      current.richieste += Number(richieste) || 0;
    } else {
      all.set(key, { nome: staticEntry?.nome || displayName, richieste: Number(richieste) || 0 });
    }
  }

  for (const row of publishedEntries) {
    if (row.attivo) addName(row.nome);
  }

  for (const row of databaseEntries) {
    if (row && row.attivo === true && typeof row.nome === 'string') {
      addName(row.nome, 0, true);
    }
  }

  for (const row of voteCounts) {
    if (row && typeof row.nome === 'string') addName(row.nome, row.richieste);
  }

  return [...all.values()].sort((a, b) =>
    b.richieste - a.richieste || a.nome.localeCompare(b.nome, 'it'));
}

// On older votes a name may have different spacing/case than its current
// ranking label. Return the ranking spelling for UI selected-state matching;
// this never changes the value stored in the original voting record.
function canonicalizeGraziaVotes(votes, ranking) {
  const displayed = new Map(ranking.map(row => [normalizeGraziaName(row.nome), row.nome]));
  return votes.map(nome => displayed.get(normalizeGraziaName(displayGraziaName(nome))) || nome);
}

module.exports = {
  getStaticGraziaEntries, getStaticGraziaByName,
  getGraziaCatalogRevision, normalizeGraziaName, mergeGraziaRanking,
  canonicalizeGraziaVotes, displayGraziaName, isHiddenGraziaName
};
