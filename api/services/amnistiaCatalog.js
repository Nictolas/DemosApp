'use strict';
const { createHash } = require('node:crypto');

// Pubblicazione editoriale nel codice; voti e proposte approvate in PostgreSQL.
// IDs legacy mantenuti dalla fotografia del catalogo di produzione 10/11/2026.
const entries = require('../catalog/amnistia.json');
const normalizeAmnistiaName = (value) => String(value || '')
  .normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('it');

const staticAmnistie = Object.freeze(entries.map(entry => Object.freeze({
  id: entry.id,
  legge: entry.legge,
  articolo: entry.articolo || '',
  descrizione: entry.descrizione || '',
  fonte_url: entry.fonte_url || null,
  precedente_storico: entry.precedente_storico || null,
  attiva: entry.attiva
})));
const byName = new Map(staticAmnistie.map(entry => [normalizeAmnistiaName(entry.legge), entry]));
const byId = new Set(staticAmnistie.map(entry => entry.id));
if (!staticAmnistie.length || byName.size !== staticAmnistie.length || byId.size !== staticAmnistie.length ||
  staticAmnistie.some(entry =>
    !Number.isSafeInteger(entry.id) || entry.id <= 0 ||
    typeof entry.legge !== 'string' || !entry.legge.trim() ||
    typeof entry.articolo !== 'string' ||
    typeof entry.descrizione !== 'string' ||
    typeof entry.attiva !== 'boolean' ||
    (entry.fonte_url !== null && (typeof entry.fonte_url !== 'string' || !entry.fonte_url.startsWith('https://'))) ||
    (entry.precedente_storico !== null && typeof entry.precedente_storico !== 'string')
  )) {
  throw new Error('Catalogo Amnistia versionato non valido: ID e titoli devono essere unici');
}
const catalogRevision = createHash('sha256').update(JSON.stringify(staticAmnistie)).digest('hex');
function getStaticAmnistie() { return staticAmnistie; }
function getStaticAmnistiaByName(name) { return byName.get(normalizeAmnistiaName(name)) || null; }
function getAmnistiaCatalogRevision() { return catalogRevision; }

// Le definizioni in codice vincono sui metadati SQL. Le righe aggiunte
// dopo approvazione Admin e non ancora versionate restano subito visibili.
function mergePublishedAmnistie(databaseRows = []) {
  const published = staticAmnistie.filter(entry => entry.attiva).map(entry => ({ ...entry }));
  const seen = new Set(published.map(entry => normalizeAmnistiaName(entry.legge)));
  for (const row of databaseRows) {
    if (!row || row.attiva !== true || typeof row.legge !== 'string' || !row.legge.trim()) continue;
    const name = normalizeAmnistiaName(row.legge);
    if (byName.has(name) || seen.has(name)) continue;
    seen.add(name);
    published.push({
      id: row.id, legge: row.legge,
      articolo: row.articolo || '', descrizione: row.descrizione || '',
      fonte_url: row.fonte_url || null,
      precedente_storico: row.precedente_storico || null, attiva: true
    });
  }
  return published;
}

class AmnistiaCatalogConflict extends Error {
  constructor(message) { super(message); this.name = 'AmnistiaCatalogConflict'; }
}

// Usare soltanto nella transazione di voto. La riga SQL serve ancora per
// amnistia_id legacy; ambienti vuoti la creano alla prima preferenza valida.
async function resolveVoteTarget(client, requestedName) {
  const codeEntry = getStaticAmnistiaByName(requestedName);
  if (codeEntry && !codeEntry.attiva) return null;
  if (codeEntry) {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))',
      ['amnistia:catalog:' + normalizeAmnistiaName(codeEntry.legge)]);
  }
  const lookup = await client.query(
    'SELECT id, legge, attiva FROM amnistia WHERE lower(btrim(legge)) = lower(btrim($1)) ORDER BY id LIMIT 2',
    [codeEntry?.legge || String(requestedName || '').trim()]
  );
  if (lookup.rows.length > 1) throw new AmnistiaCatalogConflict('Titolo Amnistia duplicato nel database');
  let row = lookup.rows[0] || null;
  if (row && !row.attiva) {
    if (codeEntry) throw new AmnistiaCatalogConflict('Catalogo statico e riga voti non riconciliati');
    return null;
  }
  if (!row && !codeEntry) return null;
  if (!row) {
    const inserted = await client.query(
      'INSERT INTO amnistia (legge, articolo, descrizione, fonte_url, precedente_storico, attiva) ' +
      'VALUES ($1, $2, $3, $4, $5, true) RETURNING id, legge, attiva',
      [codeEntry.legge, codeEntry.articolo, codeEntry.descrizione,
        codeEntry.fonte_url, codeEntry.precedente_storico]
    );
    row = inserted.rows[0];
  }
  return { id: row.id, legge: codeEntry?.legge || row.legge };
}
module.exports = {
  getStaticAmnistie, getStaticAmnistiaByName, getAmnistiaCatalogRevision,
  mergePublishedAmnistie, normalizeAmnistiaName, resolveVoteTarget, AmnistiaCatalogConflict
};
