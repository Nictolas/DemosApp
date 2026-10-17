'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  parseOfficialGazetteLifecycleAct,
  extractReferencedIndictionPublicationDate,
  chooseLifecycleTarget,
  mergeBallotForLifecycle,
} = require('../services/referendumGazetteLifecycleService');

const baseBallot = Object.freeze({
  kind: 'constitutional_confirmatory',
  question: 'Approvate il testo originario?',
  yesMeaning: 'Approva il testo.',
  noMeaning: 'Respinge il testo.',
  opensAt: '2026-03-22T06:00:00.000Z',
  closesAt: '2026-03-23T14:00:00.000Z',
  timezone: 'Europe/Rome',
  quorumKind: 'none',
  quorumThreshold: null,
  status: 'scheduled',
});

test('parses the 2026-style official question reformulation and links the prior Gazette publication date', () => {
  const html = `
    <html><body>
      <p>Visto il decreto del 13 gennaio 2026, pubblicato nella Gazzetta Ufficiale del 14 gennaio 2026, di indizione del referendum confermativo nelle date del 22 e 23 marzo;</p>
      <p>Ritenuto di precisare il quesito, fermo restando il proprio decreto del 13 gennaio 2026;</p>
      <p>Il referendum popolare confermativo gia' indetto si terra' sul seguente quesito, come riformulato dall'Ufficio centrale per il referendum in data 6 febbraio 2026: «Approvate il testo costituzionale riformulato?».</p>
      <p>Il presente decreto sara' pubblicato nella Gazzetta Ufficiale.</p>
    </body></html>`;
  const candidate = {
    externalId: '26A00663',
    title: 'Precisazione del quesito del referendum popolare confermativo. (26A00663)',
    sourceUrl: 'https://www.gazzettaufficiale.it/eli/id/2026/02/07/26A00663/sg',
    publicationDate: '2026-02-07',
    issueNumber: 31,
  };

  const record = parseOfficialGazetteLifecycleAct(html, candidate);
  assert.ok(record);
  assert.equal(record.action, 'reformulated');
  assert.equal(record.predecessorPublicationDate, '2026-01-14');
  assert.equal(record.newQuestion, 'Approvate il testo costituzionale riformulato?');
});

test('parses the 2020-style official revocation and links the prior Gazette publication date', () => {
  const html = `
    <html><body>
      <p>Revoca del decreto del Presidente della Repubblica 28 gennaio 2020, concernente indizione del referendum popolare confermativo.</p>
      <p>Visto il proprio decreto del 28 gennaio 2020, pubblicato nella Gazzetta Ufficiale della Repubblica italiana n. 23 del 29 gennaio 2020, con il quale e' stato indetto per il giorno di domenica 29 marzo 2020 il referendum popolare confermativo avente il seguente quesito: «Approvate la riduzione del numero dei parlamentari?»;</p>
      <p>E' revocato il proprio decreto del 28 gennaio 2020 di indizione del referendum popolare confermativo.</p>
    </body></html>`;
  const candidate = {
    externalId: '20A01499',
    title: 'Revoca del decreto concernente indizione del referendum popolare confermativo. (20A01499)',
    sourceUrl: 'https://www.gazzettaufficiale.it/eli/id/2020/03/06/20A01499/sg',
    publicationDate: '2020-03-06',
    issueNumber: 57,
  };

  const record = parseOfficialGazetteLifecycleAct(html, candidate);
  assert.ok(record);
  assert.equal(record.action, 'revoked');
  assert.equal(record.predecessorPublicationDate, '2020-01-29');
  assert.equal(record.newQuestion, null);
});

test('fails closed when a later act does not identify the prior induction publication', () => {
  const record = parseOfficialGazetteLifecycleAct(
    '<html><body><p>Precisazione del quesito del referendum.</p><p>Il quesito, come riformulato: «Nuovo quesito?»</p></body></html>',
    {
      externalId: '26A99999',
      title: 'Precisazione del quesito del referendum. (26A99999)',
      sourceUrl: 'https://www.gazzettaufficiale.it/eli/id/2026/02/07/26A99999/sg',
      publicationDate: '2026-02-07',
    },
  );
  assert.equal(record, null);
});

test('extracts the referenced induction publication date from both supported official phrasings', () => {
  assert.equal(
    extractReferencedIndictionPublicationDate('Visto il decreto del 13 gennaio 2026, pubblicato nella Gazzetta Ufficiale del 14 gennaio 2026, di indizione del referendum.'),
    '2026-01-14',
  );
  assert.equal(
    extractReferencedIndictionPublicationDate("Visto il proprio decreto del 28 gennaio 2020, pubblicato nella Gazzetta Ufficiale della Repubblica italiana n. 23 del 29 gennaio 2020, con il quale e' stato indetto il referendum."),
    '2020-01-29',
  );
});

test('revocation cancels the existing ballot without changing dates or question', () => {
  const merged = mergeBallotForLifecycle(baseBallot, { action: 'revoked' });
  assert.ok(merged);
  assert.equal(merged.status, 'cancelled');
  assert.equal(merged.question, baseBallot.question);
  assert.equal(merged.opensAt, baseBallot.opensAt);
  assert.equal(merged.closesAt, baseBallot.closesAt);
});

test('reformulation changes only the question and preserves the scheduled ballot', () => {
  const merged = mergeBallotForLifecycle(baseBallot, {
    action: 'reformulated',
    newQuestion: 'Approvate il nuovo testo?',
  });
  assert.ok(merged);
  assert.equal(merged.question, 'Approvate il nuovo testo?');
  assert.equal(merged.status, 'scheduled');
  assert.equal(merged.opensAt, baseBallot.opensAt);
  assert.equal(merged.closesAt, baseBallot.closesAt);
});

test('matching is fail-closed when multiple same-date predecessors cannot be distinguished', () => {
  const rows = [
    {
      civic_process_id: 'a',
      source_title: 'Indizione del referendum popolare confermativo alfa',
      payload_metadata: { ballot: { question: 'Approvate la proposta alfa?' } },
    },
    {
      civic_process_id: 'b',
      source_title: 'Indizione del referendum popolare confermativo beta',
      payload_metadata: { ballot: { question: 'Approvate la proposta beta?' } },
    },
  ];
  const target = chooseLifecycleTarget(rows, {
    searchText: 'precisazione del quesito del referendum popolare confermativo',
  });
  assert.equal(target.status, 'ambiguous');
  assert.equal(target.row, null);
});

test('matching selects the unique same-date predecessor when the later act repeats distinctive question terms', () => {
  const rows = [
    {
      civic_process_id: 'a',
      source_title: 'Indizione referendum ordinamento giurisdizionale corte disciplinare',
      payload_metadata: { ballot: { question: 'Approvate norme in materia di ordinamento giurisdizionale e Corte disciplinare?' } },
    },
    {
      civic_process_id: 'b',
      source_title: 'Indizione referendum riduzione numero parlamentari',
      payload_metadata: { ballot: { question: 'Approvate la riduzione del numero dei parlamentari?' } },
    },
  ];
  const target = chooseLifecycleTarget(rows, {
    searchText: 'precisazione quesito norme materia ordinamento giurisdizionale istituzione corte disciplinare',
  });
  assert.equal(target.status, 'matched');
  assert.equal(target.row.civic_process_id, 'a');
});
