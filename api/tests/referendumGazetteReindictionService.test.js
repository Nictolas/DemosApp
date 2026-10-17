'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  extractReindictionPredecessorPublicationDate,
  parseOfficialGazetteReindictionAct,
  applyReindictionRecord,
} = require('../services/referendumGazetteReindictionService');

const candidate2020 = Object.freeze({
  externalId: '20A03946',
  title: 'Indizione del referendum popolare confermativo relativo alla riduzione del numero dei parlamentari. (20A03946)',
  sourceUrl: 'https://www.gazzettaufficiale.it/eli/id/2020/07/18/20A03946/sg',
  fullTextUrl: 'https://www.gazzettaufficiale.it/atto/vediMenuHTML?atto.codiceRedazionale=20A03946&atto.dataPubblicazioneGazzetta=2020-07-18&tipoSerie=serie_generale&tipoVigenza=originario',
  publicationDate: '2020-07-18',
  issueNumber: 180,
});

const reindiction2020Html = `
<html><body>
  <p>DECRETO DEL PRESIDENTE DELLA REPUBBLICA 17 luglio 2020</p>
  <p>Indizione del referendum popolare confermativo relativo all'approvazione del testo della legge costituzionale recante «modifiche agli articoli 56, 57 e 59 della Costituzione in materia di riduzione del numero dei parlamentari».</p>
  <p>Visto il decreto del Presidente della Repubblica del 5 marzo 2020, pubblicato nella Gazzetta Ufficiale della Repubblica italiana n. 57 del 6 marzo 2020, con cui e' stato revocato il decreto del Presidente della Repubblica del 28 gennaio 2020, pubblicato nella Gazzetta Ufficiale della Repubblica italiana n. 23 del 29 gennaio 2020, con il quale e' stato indetto, per il giorno di domenica 29 marzo 2020, il referendum popolare confermativo avente il seguente quesito: «Approvate il testo della legge costituzionale concernente "Modifiche agli articoli 56, 57 e 59 della Costituzione in materia di riduzione del numero dei parlamentari", approvato dal Parlamento?»;</p>
  <p>E' indetto il referendum popolare confermativo avente il seguente quesito: «Approvate il testo della legge costituzionale concernente "Modifiche agli articoli 56, 57 e 59 della Costituzione in materia di riduzione del numero dei parlamentari", approvato dal Parlamento?» I relativi comizi sono convocati per i giorni di domenica 20 settembre e di lunedi' 21 settembre 2020. Il presente decreto sara' pubblicato nella Gazzetta Ufficiale.</p>
</body></html>`;

test('extracts the original induction publication date from the official revocation -> reindiction chain', () => {
  const text = reindiction2020Html.replace(/<[^>]+>/g, ' ');
  assert.equal(extractReindictionPredecessorPublicationDate(text), '2020-01-29');
});

test('parses the 2020 official reindiction as continuity of the January referendum', () => {
  const record = parseOfficialGazetteReindictionAct(
    reindiction2020Html,
    candidate2020,
    new Date('2020-07-18T12:00:00Z'),
  );
  assert.ok(record);
  assert.equal(record.action, 'reindicted');
  assert.equal(record.externalId, '20A03946');
  assert.equal(record.predecessorPublicationDate, '2020-01-29');
  assert.match(record.question, /riduzione del numero dei parlamentari/i);
});

test('does not treat an ordinary first induction as a reindiction', () => {
  const html = `
    <html><body>
      <p>E' indetto il referendum popolare confermativo avente il seguente quesito: «Approvate il testo costituzionale?» I relativi comizi sono convocati per il giorno di domenica 22 marzo 2026. Il presente decreto sara' pubblicato nella Gazzetta Ufficiale.</p>
    </body></html>`;
  const record = parseOfficialGazetteReindictionAct(html, {
    externalId: '26A00001',
    title: 'Indizione del referendum popolare confermativo. (26A00001)',
    sourceUrl: 'https://www.gazzettaufficiale.it/eli/id/2026/01/14/26A00001/sg',
    publicationDate: '2026-01-14',
    issueNumber: 10,
  }, new Date('2026-01-14T12:00:00Z'));
  assert.equal(record, null);
});

test('fails closed before merging when a duplicate reindiction ballot already has user positions', async () => {
  const queries = [];
  const client = {
    async query(sql, params = []) {
      const normalized = String(sql).replace(/\s+/g, ' ').trim();
      queries.push({ sql: normalized, params });
      if (normalized === 'BEGIN' || normalized === 'ROLLBACK') return { rows: [] };
      if (normalized.includes('FROM civic_process_source_records sr') && normalized.includes('sr.presented_at')) {
        return { rows: [{
          source_record_id: 'old-source',
          external_id: '20A00671',
          civic_process_id: 'old-process',
          source_title: 'Indizione referendum riduzione numero parlamentari',
          source_stage: 'ballot_scheduled',
          source_status: 'cancelled',
          payload_metadata: { ballot: { question: 'Approvate la riduzione del numero dei parlamentari?' } },
        }] };
      }
      if (normalized.includes('WHERE sr.source_id = $1 AND sr.external_id = $2')) {
        return { rows: [{
          source_record_id: 'new-source',
          civic_process_id: 'new-process',
          jurisdiction_id: 'it',
          process_type_id: 'it.referendum_signature_request',
          canonical_stage: 'ballot_scheduled',
          canonical_url: null,
          official_reference: 'GU:20A03946',
          first_official_date: '2020-07-18',
          latest_official_date: '2020-07-18',
        }] };
      }
      if (normalized.includes('FROM civic_processes') && normalized.includes('WHERE id = $1')) {
        return { rows: [{
          id: 'old-process',
          jurisdiction_id: 'it',
          process_type_id: 'it.referendum_signature_request',
          canonical_stage: 'ballot_scheduled',
          canonical_url: null,
          official_reference: 'GU:20A00671',
          first_official_date: '2020-01-29',
          latest_official_date: '2020-03-06',
        }] };
      }
      if (normalized.includes('FROM civic_ballots b') && params[0] === 'new-process') {
        return { rows: [{ id: 'new-ballot', has_positions: true, has_snapshots: false }] };
      }
      if (normalized.includes('FROM civic_ballots b') && params[0] === 'old-process') {
        return { rows: [{ id: 'old-ballot', has_positions: true, has_snapshots: true }] };
      }
      throw new Error(`Unexpected query in fake client: ${normalized}`);
    },
    release() {},
  };
  const pool = { async connect() { return client; } };

  const result = await applyReindictionRecord(pool, {
    externalId: '20A03946',
    predecessorPublicationDate: '2020-01-29',
    searchText: 'riduzione numero parlamentari',
  });

  assert.equal(result.status, 'unsafe_duplicate_ballot_usage');
  assert.ok(queries.some((entry) => entry.sql === 'ROLLBACK'));
  assert.equal(queries.some((entry) => /^DELETE FROM civic_ballots/.test(entry.sql)), false);
  assert.equal(queries.some((entry) => /^UPDATE civic_process_identifiers/.test(entry.sql)), false);
  assert.equal(queries.some((entry) => /^DELETE FROM civic_processes/.test(entry.sql)), false);
});
