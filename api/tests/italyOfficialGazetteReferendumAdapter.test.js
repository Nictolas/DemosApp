'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseArchiveIssues,
  parseIssueReferendumCandidates,
  parseOfficialGazetteReferendumAct,
} = require('../services/civicSources/italyOfficialGazetteReferendumAdapter');

test('parses official Gazette archive issues deterministically', () => {
  const html = `
    <html><body>
      <a href="/issue/10">n° 10 del 14-01-2026</a>
      <a href="/issue/11">n° 11 del 15-01-2026</a>
    </body></html>`;
  const issues = parseArchiveIssues(html);
  assert.equal(issues.length, 2);
  assert.equal(issues[0].number, 10);
  assert.equal(issues[0].dateString, '2026-01-14');
  assert.match(issues[0].url, /numeroGazzetta=10/);
});

test('extracts referendum candidates from an issue summary', () => {
  const issue = { number: 10, dateString: '2026-01-14' };
  const html = `
    <html><body>
      <a href="/eli/id/2026/01/14/26A00167/sg">
        DECRETO DEL PRESIDENTE DELLA REPUBBLICA - Indizione del referendum popolare confermativo di prova. (26A00167) Pag. 1
      </a>
      <a href="/eli/id/2026/01/14/26A00166/sg">Indizione dei comizi per una elezione. (26A00166)</a>
    </body></html>`;
  const candidates = parseIssueReferendumCandidates(html, issue);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0].externalId, '26A00167');
  assert.equal(candidates[0].publicationDate, '2026-01-14');
  assert.match(candidates[0].fullTextUrl, /vediMenuHTML/);
});

test('normalizes a confirmatory referendum ballot from the official act text', () => {
  const html = `
    <html><body>
      <p>Indizione del referendum popolare confermativo della legge costituzionale di prova.</p>
      <p>È indetto il referendum popolare confermativo sul seguente quesito: «Approvate il testo costituzionale di prova?».</p>
      <p>I relativi comizi sono convocati per i giorni di domenica 22 marzo e lunedi' 23 marzo 2026.</p>
      <p>Il presente decreto sarà pubblicato nella Gazzetta Ufficiale.</p>
    </body></html>`;
  const candidate = {
    externalId: '26A00167',
    title: 'Indizione del referendum popolare confermativo di prova. (26A00167) Pag. 1',
    sourceUrl: 'https://www.gazzettaufficiale.it/eli/id/2026/01/14/26A00167/sg',
    publicationDate: '2026-01-14',
    issueNumber: 10,
  };
  const record = parseOfficialGazetteReferendumAct(html, candidate, new Date('2026-01-20T00:00:00Z'));
  assert.ok(record);
  assert.equal(record.stageId, 'ballot_scheduled');
  assert.equal(record.metadata.ballot.kind, 'constitutional_confirmatory');
  assert.equal(record.metadata.ballot.quorumKind, 'none');
  assert.equal(record.metadata.ballot.question, 'Approvate il testo costituzionale di prova?');
  assert.equal(record.metadata.ballot.opensAt, '2026-03-22T06:00:00.000Z');
  assert.equal(record.metadata.ballot.closesAt, '2026-03-23T14:00:00.000Z');
});

test('uses turnout quorum for an abrogative referendum and closes past ballots', () => {
  const html = `
    <html><body>
      <p>Indizione del referendum popolare abrogativo di prova.</p>
      <p>È indetto il referendum popolare abrogativo sul seguente quesito: «Volete voi abrogare la norma di prova?».</p>
      <p>I relativi comizi sono convocati per i giorni di domenica 8 giugno e lunedi' 9 giugno 2025.</p>
      <p>Il presente decreto sarà pubblicato nella Gazzetta Ufficiale.</p>
    </body></html>`;
  const candidate = {
    externalId: '25A02038',
    title: 'Indizione del referendum popolare abrogativo di prova. (25A02038)',
    sourceUrl: 'https://www.gazzettaufficiale.it/eli/id/2025/03/31/25A02038/sg',
    publicationDate: '2025-03-31',
    issueNumber: 75,
  };
  const record = parseOfficialGazetteReferendumAct(html, candidate, new Date('2026-10-17T00:00:00Z'));
  assert.ok(record);
  assert.equal(record.stageId, 'closed');
  assert.equal(record.metadata.ballot.kind, 'abrogative');
  assert.equal(record.metadata.ballot.quorumKind, 'turnout_threshold');
  assert.equal(record.metadata.ballot.quorumThreshold, 0.5);
});
