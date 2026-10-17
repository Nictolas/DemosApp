'use strict';

const axios = require('axios');
const { romeLocalToUtcIso } = require('./italyOfficialGazetteReferendumAdapter');

const SOURCE_ID = 'it.interior.eligendo';
const BASE_URL = 'https://eleapi.interno.gov.it/siel/PX';
const PUBLIC_URL = 'https://elezioni.interno.gov.it/eligendo/';
const REFERENDUM_ELECTION_TYPE = '09';
const DEFAULT_TIMEOUT_MS = 15000;

function normalizeSpace(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function normalizeComparable(value) {
  return normalizeSpace(value)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function parseNumber(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const normalized = String(value).trim().replace(/\./g, '').replace(',', '.');
  const number = Number(normalized);
  return Number.isFinite(number) ? number : null;
}

function asInteger(value) {
  const number = parseNumber(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function yyyymmddInRome(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Rome',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const byType = Object.fromEntries(parts.filter((part) => part.type !== 'literal').map((part) => [part.type, part.value]));
  if (!byType.year || !byType.month || !byType.day) return null;
  return `${byType.year}${byType.month}${byType.day}`;
}

function parseProviderTimestamp(value) {
  const digits = String(value ?? '').replace(/\D/g, '');
  if (digits.length < 8) return null;
  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const hour = digits.length >= 10 ? Number(digits.slice(8, 10)) : 0;
  const minute = digits.length >= 12 ? Number(digits.slice(10, 12)) : 0;
  const second = digits.length >= 14 ? Number(digits.slice(12, 14)) : 0;
  if (![year, month, day, hour, minute, second].every(Number.isFinite)) return null;
  try {
    return romeLocalToUtcIso({ year, month, day, hour, minute, second });
  } catch {
    return null;
  }
}

function getProviderError(payload) {
  const error = payload?.Error || payload?.error;
  if (!error) return null;
  return normalizeSpace(error.desc || error.message || error.value || 'Errore Eligendo');
}

function extractSheets(payload) {
  return Array.isArray(payload?.scheda) ? payload.scheda : [];
}

function getSheetByCode(payload, code) {
  const target = Number(code);
  if (!Number.isFinite(target)) return null;
  return extractSheets(payload).find((sheet) => Number(sheet?.cod) === target) || null;
}

function tokenSet(value) {
  return new Set(normalizeComparable(value).split(' ').filter((token) => token.length >= 4));
}

function tokenOverlapScore(left, right) {
  const a = tokenSet(left);
  const b = tokenSet(right);
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) if (b.has(token)) intersection += 1;
  return intersection / Math.min(a.size, b.size);
}

function resolveQuestionCode({ ballot, italyPayload, candidateCountForDate = 1 }) {
  const explicit = asInteger(ballot?.eligendoQuestionCode || ballot?.eligendo_question_code);
  if (explicit) return { code: explicit, method: 'explicit' };

  const sheets = extractSheets(italyPayload);
  if (sheets.length === 1 && candidateCountForDate === 1) {
    const code = asInteger(sheets[0]?.cod);
    return code ? { code, method: 'single_question' } : null;
  }

  const question = ballot?.question || ballot?.questionText || ballot?.question_text;
  if (!question) return null;
  const scored = sheets
    .filter((sheet) => normalizeSpace(sheet?.desc))
    .map((sheet) => ({
      code: asInteger(sheet.cod),
      score: tokenOverlapScore(question, sheet.desc),
    }))
    .filter((entry) => entry.code && entry.score >= 0.6)
    .sort((a, b) => b.score - a.score);

  if (!scored.length) return null;
  if (scored.length > 1 && Math.abs(scored[0].score - scored[1].score) < 0.1) return null;
  return { code: scored[0].code, method: 'question_text' };
}

function areaResult(payload, questionCode) {
  const providerError = getProviderError(payload);
  if (providerError) return { error: providerError };
  const header = payload?.int && typeof payload.int === 'object' ? payload.int : null;
  const sheet = getSheetByCode(payload, questionCode);
  if (!header || !sheet) return { error: 'QUESITO_NON_TROVATO' };

  const electors = asInteger(header.ele_t);
  const sectionsTotal = asInteger(header.sz_tot);
  const sectionsReported = asInteger(sheet.sz_perv);
  const voters = asInteger(sheet.vot_t);
  const yesVotes = asInteger(sheet.voti_si);
  const noVotes = asInteger(sheet.voti_no);
  const blankVotes = asInteger(sheet.sk_bianche) || 0;
  const invalidVotes = asInteger(sheet.sk_nulle) || 0;
  const contestedVotes = asInteger(sheet.sk_contestate) || 0;

  if ([electors, sectionsTotal, sectionsReported, voters, yesVotes, noVotes].some((value) => value == null || value < 0)) {
    return { error: 'RISULTATO_INCOMPLETO' };
  }

  return {
    electors,
    sectionsTotal,
    sectionsReported,
    voters,
    yesVotes,
    noVotes,
    blankVotes,
    invalidVotes,
    contestedVotes,
    complete: sectionsTotal > 0 && sectionsReported >= sectionsTotal,
    updatedAt: parseProviderTimestamp(sheet.dt_agg),
  };
}

function combineNationalResult({ italyPayload, abroadPayload, questionCode }) {
  const italy = areaResult(italyPayload, questionCode);
  const abroad = areaResult(abroadPayload, questionCode);
  if (italy.error || abroad.error) {
    return {
      complete: false,
      error: italy.error || abroad.error,
      italy,
      abroad,
    };
  }

  const electors = italy.electors + abroad.electors;
  const voters = italy.voters + abroad.voters;
  const yesVotes = italy.yesVotes + abroad.yesVotes;
  const noVotes = italy.noVotes + abroad.noVotes;
  const validVotes = yesVotes + noVotes;
  const sectionsTotal = italy.sectionsTotal + abroad.sectionsTotal;
  const sectionsReported = italy.sectionsReported + abroad.sectionsReported;
  const complete = italy.complete && abroad.complete && sectionsReported >= sectionsTotal && sectionsTotal > 0;
  const updatedAt = [italy.updatedAt, abroad.updatedAt]
    .filter(Boolean)
    .sort()
    .at(-1) || null;

  return {
    complete,
    questionCode: Number(questionCode),
    electorCount: electors,
    voterCount: voters,
    yesVotes,
    noVotes,
    blankVotes: italy.blankVotes + abroad.blankVotes,
    invalidVotes: italy.invalidVotes + abroad.invalidVotes,
    contestedVotes: italy.contestedVotes + abroad.contestedVotes,
    sectionsTotal,
    sectionsReported,
    turnoutPercent: electors > 0 ? Number(((voters / electors) * 100).toFixed(3)) : null,
    yesPercent: validVotes > 0 ? Number(((yesVotes / validVotes) * 100).toFixed(3)) : null,
    noPercent: validVotes > 0 ? Number(((noVotes / validVotes) * 100).toFixed(3)) : null,
    updatedAt,
    coverage: 'italy_and_abroad',
  };
}

async function defaultHttpGet(url) {
  const response = await axios.get(url, {
    timeout: DEFAULT_TIMEOUT_MS,
    responseType: 'json',
    headers: {
      Origin: 'https://elezioni.interno.gov.it',
      Referer: 'https://elezioni.interno.gov.it/',
      'User-Agent': 'Mozilla/5.0 (compatible; DEMOS/1.0; +https://www.demos.community)',
      Accept: 'application/json, text/plain, */*',
    },
    maxRedirects: 5,
  });
  return response.data;
}

function resultsUrl({ electionDate, abroad = false }) {
  const endpoint = abroad ? 'scrutiniFE' : 'scrutiniFI';
  return `${BASE_URL}/${endpoint}/DE/${electionDate}/TE/${REFERENDUM_ELECTION_TYPE}`;
}

async function fetchNationalReferendumResult({ electionDate, ballot, candidateCountForDate = 1, httpGet = defaultHttpGet }) {
  if (!/^\d{8}$/.test(String(electionDate || ''))) throw new Error('ELIGENDO_ELECTION_DATE_REQUIRED');

  const [italyPayload, abroadPayload] = await Promise.all([
    httpGet(resultsUrl({ electionDate, abroad: false })),
    httpGet(resultsUrl({ electionDate, abroad: true })),
  ]);

  const italyError = getProviderError(italyPayload);
  const abroadError = getProviderError(abroadPayload);
  if (italyError || abroadError) {
    return {
      available: false,
      pending: true,
      providerError: italyError || abroadError,
    };
  }

  const resolved = resolveQuestionCode({ ballot, italyPayload, candidateCountForDate });
  if (!resolved) {
    return {
      available: false,
      pending: false,
      ambiguous: true,
      reason: 'ELIGENDO_QUESTION_MAPPING_AMBIGUOUS',
    };
  }

  const result = combineNationalResult({
    italyPayload,
    abroadPayload,
    questionCode: resolved.code,
  });

  return {
    available: result.complete === true,
    pending: result.complete !== true,
    ambiguous: false,
    mappingMethod: resolved.method,
    result,
  };
}

module.exports = {
  SOURCE_ID,
  BASE_URL,
  PUBLIC_URL,
  REFERENDUM_ELECTION_TYPE,
  parseNumber,
  yyyymmddInRome,
  parseProviderTimestamp,
  resolveQuestionCode,
  areaResult,
  combineNationalResult,
  resultsUrl,
  fetchNationalReferendumResult,
};
