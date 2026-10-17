'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  parseNumber,
  yyyymmddInRome,
  resolveQuestionCode,
  combineNationalResult,
  resultsUrl,
  resolveNationalResultFromPayloads,
} = require('../services/civicSources/italyInteriorEligendoReferendumAdapter');
const { buildSourceRecord } = require('../services/italianReferendumResultSyncService');

function payload({ area, electors, sectionsTotal, sheets }) {
  return {
    int: {
      area,
      ele_t: electors,
      sz_tot: sectionsTotal,
      t_ele: 'Referendum',
    },
    scheda: sheets,
  };
}

test('normalizes Eligendo numeric formats and Rome election date', () => {
  assert.equal(parseNumber('30,58'), 30.58);
  assert.equal(parseNumber('45.997.941'), 45997941);
  assert.equal(yyyymmddInRome('2026-03-22T06:00:00.000Z'), '20260322');
  assert.equal(resultsUrl({ electionDate: '20260322', abroad: false }), 'https://eleapi.interno.gov.it/siel/PX/scrutiniFI/DE/20260322/TE/09');
  assert.equal(resultsUrl({ electionDate: '20260322', abroad: true }), 'https://eleapi.interno.gov.it/siel/PX/scrutiniFE/DE/20260322/TE/09');
});

test('single referendum maps deterministically to the only Eligendo question', () => {
  const italyPayload = payload({
    area: 'I',
    electors: 100,
    sectionsTotal: 10,
    sheets: [{ cod: 1, desc: null }],
  });
  assert.deepEqual(
    resolveQuestionCode({ ballot: { question: 'Quesito ufficiale?' }, italyPayload, candidateCountForDate: 1 }),
    { code: 1, method: 'single_question' },
  );
});

test('multiple null-description questions remain fail-closed instead of guessing by order', () => {
  const italyPayload = payload({
    area: 'I',
    electors: 100,
    sectionsTotal: 10,
    sheets: [
      { cod: 1, desc: null },
      { cod: 2, desc: null },
    ],
  });
  assert.equal(
    resolveQuestionCode({ ballot: { question: 'Secondo quesito?' }, italyPayload, candidateCountForDate: 2 }),
    null,
  );

  assert.deepEqual(
    resolveQuestionCode({ ballot: { question: 'Secondo quesito?', eligendoQuestionCode: 2 }, italyPayload, candidateCountForDate: 2 }),
    { code: 2, method: 'explicit' },
  );
});

test('combines Italy and abroad only when both areas are complete', () => {
  const italyPayload = payload({
    area: 'I',
    electors: 1000,
    sectionsTotal: 100,
    sheets: [{
      cod: 1,
      sz_perv: 100,
      vot_t: 600,
      voti_si: 330,
      voti_no: 240,
      sk_bianche: 20,
      sk_nulle: 10,
      sk_contestate: 0,
      dt_agg: 20260323161000,
    }],
  });
  const abroadPayload = payload({
    area: 'E',
    electors: 200,
    sectionsTotal: 20,
    sheets: [{
      cod: 1,
      sz_perv: 20,
      vot_t: 100,
      voti_si: 60,
      voti_no: 30,
      sk_bianche: 5,
      sk_nulle: 5,
      sk_contestate: 0,
      dt_agg: 20260323170000,
    }],
  });

  const result = combineNationalResult({ italyPayload, abroadPayload, questionCode: 1 });
  assert.equal(result.complete, true);
  assert.equal(result.electorCount, 1200);
  assert.equal(result.voterCount, 700);
  assert.equal(result.yesVotes, 390);
  assert.equal(result.noVotes, 270);
  assert.equal(result.sectionsReported, 120);
  assert.equal(result.sectionsTotal, 120);
  assert.equal(result.turnoutPercent, 58.333);
  assert.equal(result.yesPercent, 59.091);
  assert.equal(result.noPercent, 40.909);
  assert.equal(result.coverage, 'italy_and_abroad');
});

test('partial sections never become an official final result', () => {
  const italyPayload = payload({
    area: 'I',
    electors: 1000,
    sectionsTotal: 100,
    sheets: [{ cod: 1, sz_perv: 99, vot_t: 600, voti_si: 330, voti_no: 240 }],
  });
  const abroadPayload = payload({
    area: 'E',
    electors: 200,
    sectionsTotal: 20,
    sheets: [{ cod: 1, sz_perv: 20, vot_t: 100, voti_si: 60, voti_no: 30 }],
  });
  const resolved = resolveNationalResultFromPayloads({
    ballot: { question: 'Quesito?' },
    candidateCountForDate: 1,
    italyPayload,
    abroadPayload,
  });
  assert.equal(resolved.available, false);
  assert.equal(resolved.pending, true);
  assert.equal(resolved.result.complete, false);
});

test('provider errors are pending, while ambiguous question mapping is explicit', () => {
  const pending = resolveNationalResultFromPayloads({
    ballot: { question: 'Quesito?' },
    candidateCountForDate: 1,
    italyPayload: { Error: { desc: 'Dati non trovati' } },
    abroadPayload: { Error: { desc: 'Dati non trovati' } },
  });
  assert.equal(pending.pending, true);
  assert.equal(pending.providerError, 'Dati non trovati');

  const italyPayload = payload({
    area: 'I',
    electors: 1000,
    sectionsTotal: 10,
    sheets: [
      { cod: 1, desc: null },
      { cod: 2, desc: null },
    ],
  });
  const abroadPayload = payload({
    area: 'E',
    electors: 100,
    sectionsTotal: 2,
    sheets: [
      { cod: 1, desc: null },
      { cod: 2, desc: null },
    ],
  });
  const ambiguous = resolveNationalResultFromPayloads({
    ballot: { question: 'Quesito B?' },
    candidateCountForDate: 2,
    italyPayload,
    abroadPayload,
  });
  assert.equal(ambiguous.ambiguous, true);
  assert.equal(ambiguous.reason, 'ELIGENDO_QUESTION_MAPPING_AMBIGUOUS');
});

test('builds an Eligendo source record that preserves the official Gazzetta ballot metadata', () => {
  const candidate = {
    civic_process_id: '11111111-1111-4111-8111-111111111111',
    title: 'Referendum costituzionale',
    official_reference: 'GU:26A00167',
    official_identifiers: [
      { namespace: 'it.official_gazette.redaction_code', value: '26A00167' },
    ],
    presented_at: '2026-01-14',
    payload_metadata: {
      ballot: {
        kind: 'constitutional_confirmatory',
        question: 'Approvate il testo?',
        yesMeaning: 'Approva il testo.',
        noMeaning: 'Respinge il testo.',
        opensAt: '2026-03-22T06:00:00.000Z',
        closesAt: '2026-03-23T14:00:00.000Z',
        timezone: 'Europe/Rome',
        quorumKind: 'none',
        quorumThreshold: null,
        status: 'scheduled',
      },
    },
  };
  const record = buildSourceRecord(candidate, {
    electionDate: '20260322',
    questionCode: 1,
    mappingMethod: 'single_question',
    result: {
      complete: true,
      turnoutPercent: 55.5,
      yesPercent: 52.1,
      noPercent: 47.9,
      electorCount: 1000,
      voterCount: 555,
      yesVotes: 280,
      noVotes: 257,
      blankVotes: 10,
      invalidVotes: 8,
      contestedVotes: 0,
      sectionsReported: 100,
      sectionsTotal: 100,
      coverage: 'italy_and_abroad',
      updatedAt: '2026-03-23T16:00:00.000Z',
    },
  });

  assert.equal(record.sourceId, 'it.interior.eligendo');
  assert.equal(record.stageId, 'closed');
  assert.equal(record.officialReference, 'GU:26A00167');
  assert.equal(record.metadata.ballot.kind, 'constitutional_confirmatory');
  assert.equal(record.metadata.ballot.eligendoQuestionCode, 1);
  assert.equal(record.metadata.ballot.officialResult.complete, true);
  assert.equal(record.metadata.ballot.officialResult.turnoutPercent, 55.5);
});
