'use strict';

// Standalone GROQ-02 provider smoke on a dedicated Render Free service.
// No DB, Firebase, scheduler, user records, or public text-generation route.
// This service performs one connectivity check and one bounded set of source QA calls per start.
// Its HTTP endpoints only expose sanitized status, never keys or model output.
const http = require('node:http');
const { checkGroqFreeConnectivity } = require('../services/groqFreeSmokeService');
const { runOfficialCaseQA } = require('./groq_official_case_qa');

const SAFE_STATUSES = new Set([
  'OK', 'NOT_CONFIGURED', 'MODEL_NOT_ALLOWED', 'FREE_QUOTA_UNAVAILABLE',
  'EMPTY_OR_TRUNCATED', 'UNEXPECTED_RESPONSE', 'AUTH', 'MODEL_NOT_FOUND',
  'INVALID_REQUEST', 'RATE_LIMIT', 'PROVIDER_UNAVAILABLE',
  'SOURCE_MISMATCH', 'NETWORK_OR_UNKNOWN'
]);

function sanitizeResult(result) {
  const status = SAFE_STATUSES.has(result?.status) ? result.status : 'NETWORK_OR_UNKNOWN';
  return {
    status,
    success: status === 'OK' && result?.success === true
  };
}

async function runOneProbe({ env = process.env, check = checkGroqFreeConnectivity } = {}) {
  if (typeof env.GROQ_API_KEY !== 'string' || !env.GROQ_API_KEY.trim()) {
    return { status: 'NOT_CONFIGURED', success: false };
  }
  // The existing Groq Free policy allowlists models and budgets the single
  // provider call; the smoke service disables SDK retries and paid fallback.
  try {
    return sanitizeResult(await check({ env }));
  } catch (_) {
    // Never log or serialize provider exceptions, headers, token, or output.
    return { status: 'NETWORK_OR_UNKNOWN', success: false };
  }
}

// Opt-in stability QA. Bound calls to three, never read a client-provided count,
// and default to the historical single call. All samples use the Free-only gate.
function requestedCaseSamples(env = process.env) {
  return env.GROQ_QA_REPEATS === '3' ? 3 : 1;
}

function selectedCaseId(env = process.env) {
  return ['T002', 'T003', 'T006', 'T009', 'T010', 'T011', 'T012', 'T013', 'T018', 'T023'].includes(env.GROQ_QA_CASE_ID)
    ? env.GROQ_QA_CASE_ID : 'T008';
}

async function runCaseSamples({ env = process.env, runCase = runOfficialCaseQA } = {}) {
  const samplesRequested = requestedCaseSamples(env);
  const caseId = selectedCaseId(env);
  const results = [];
  for (let index = 0; index < samplesRequested; index++) {
    let value;
    try {
      value = await runCase({ env });
    } catch (_) {
      value = { caseId, status: 'NETWORK_OR_UNKNOWN', success: false, verifiedFields: 0 };
    }
    // Only keep allowlisted structural diagnostics. Never retain model output.
    const safeStatus = value?.status;
    results.push({
      caseId: value?.caseId,
      status: safeStatus,
      success: value?.success === true,
      verifiedFields: Number.isInteger(value?.verifiedFields) ? value.verifiedFields : 0,
      failedFields: Array.isArray(value?.failedFields) ? value.failedFields : [],
      ...(caseId === 'T023' ? {
        safeArticleFlags: {
          noNewCostsFound: value?.explanationDiagnostics?.noNewCostsFound === true,
          approvedFound: value?.explanationDiagnostics?.approvedFound === true,
          falselyFinalFound: value?.explanationDiagnostics?.falselyFinalFound === true
        }
      } : {}),
      ...(caseId === 'T013' ? {
        safeFlags: {
          thresholdFound: value?.explanationDiagnostics?.thresholdFound === true,
          immediateLegislatureFound: value?.explanationDiagnostics?.immediateLegislatureFound === true,
          laterLegislatureFound: value?.explanationDiagnostics?.laterLegislatureFound === true,
          rejectedFound: value?.explanationDiagnostics?.rejectedFound === true,
          confusedWith18Months: value?.explanationDiagnostics?.confusedWith18Months === true
        }
      } : {})
    });
    // Do not hammer a Free provider when admission/auth/provider fails.
    if (['RATE_LIMIT', 'FREE_QUOTA_UNAVAILABLE', 'NOT_CONFIGURED',
         'MODEL_NOT_ALLOWED', 'AUTH', 'PROVIDER_UNAVAILABLE', 'NETWORK_OR_UNKNOWN'].includes(safeStatus)) break;
  }

  const matches = results.map(result =>
    result.caseId === caseId && result.status === 'OK' &&
    result.success && result.verifiedFields === 10 && result.failedFields.length === 0
  );
  const samplesPassed = matches.filter(Boolean).length;
  const success = results.length === samplesRequested && samplesPassed === samplesRequested;
  const failure = results.find(result => result.status !== 'OK');
  return {
    caseId,
    status: success ? 'OK' : failure?.status && failure.status !== 'OK' ? failure.status : 'SOURCE_MISMATCH',
    success,
    verifiedFields: Math.min(...results.map(result => result.verifiedFields)),
    failedFields: [...new Set(results.flatMap(result => result.failedFields))],
    samplesRequested,
    samplesCompleted: results.length,
    samplesPassed,
    ...(caseId === 'T023' ? {
      t023SampleCategories: results.map(r => SAFE_STATUSES.has(r.status) ? r.status : 'NETWORK_OR_UNKNOWN'),
      t023SampleScores: results.map(r => Math.max(0, Math.min(10, r.verifiedFields))),
      t023FlagTallies: Object.fromEntries(
        ['noNewCostsFound','approvedFound','falselyFinalFound']
          .map(flag => [flag, results.filter(r => r.safeArticleFlags?.[flag] === true).length])
      )
    } : {}),
    ...(caseId === 'T013' ? {
      sampleCategories: results.map(r => SAFE_STATUSES.has(r.status) ? r.status : 'NETWORK_OR_UNKNOWN'),
      sampleFieldScores: results.map(r => Math.max(0, Math.min(10, r.verifiedFields))),
      t013FlagTallies: Object.fromEntries(
        ['thresholdFound','immediateLegislatureFound','laterLegislatureFound','rejectedFound','confusedWith18Months']
          .map(flag => [flag, results.filter(r => r.safeFlags?.[flag] === true).length])
      )
    } : {})
  };
}

function sanitizeCaseResult(result) {
  const safe = new Set(['PENDING', 'OK', 'NOT_RUN', 'NOT_CONFIGURED', 'MODEL_NOT_ALLOWED', 'FREE_QUOTA_UNAVAILABLE', 'EMPTY_OR_TRUNCATED', 'INVALID_JSON', 'SOURCE_MISMATCH', 'AUTH', 'MODEL_NOT_FOUND', 'INVALID_REQUEST', 'RATE_LIMIT', 'PROVIDER_UNAVAILABLE', 'NETWORK_OR_UNKNOWN']);
  const status = safe.has(result?.status) ? result.status : 'NETWORK_OR_UNKNOWN';
  const count = Number(result?.verifiedFields);
  const latency = Number(result?.latencyMs);
  return {
    caseId: ['T002', 'T003', 'T006', 'T009', 'T010', 'T011', 'T012', 'T013', 'T018', 'T023'].includes(process.env.GROQ_QA_CASE_ID) ? process.env.GROQ_QA_CASE_ID : 'T008',
    status,
    success: status === 'OK' && result?.success === true,
    verifiedFields: Number.isInteger(count) ? Math.max(0, Math.min(10, count)) : 0,
    failedFields: Array.isArray(result?.failedFields) ? result.failedFields.filter(field => ['atto','data_voto','favorevoli','contrari','astenuti','esito','numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'].includes(field)).slice(0, 10) : [],
    ...(Number.isInteger(result?.samplesRequested) && [1, 3].includes(result.samplesRequested) ? {
      samplesRequested: result.samplesRequested,
      samplesCompleted: Number.isInteger(result.samplesCompleted) && result.samplesCompleted >= 0 && result.samplesCompleted <= 3 ? result.samplesCompleted : 0,
      samplesPassed: Number.isInteger(result.samplesPassed) && result.samplesPassed >= 0 && result.samplesPassed <= 3 ? result.samplesPassed : 0
    } : {}),
    ...(result?.caseId === 'T023' && Array.isArray(result?.t023SampleCategories) ? {
      t023SampleCategories: result.t023SampleCategories.slice(0,3).map(status => safe.has(status) ? status : 'NETWORK_OR_UNKNOWN'),
      t023SampleScores: (Array.isArray(result.t023SampleScores) ? result.t023SampleScores : [])
        .slice(0,3).map(v => Number.isInteger(v) && v >= 0 && v <= 10 ? v : 0),
      t023FlagTallies: Object.fromEntries(
        ['noNewCostsFound','approvedFound','falselyFinalFound']
          .map(flag => [flag,
            Number.isInteger(result.t023FlagTallies?.[flag]) &&
              result.t023FlagTallies[flag] >= 0 && result.t023FlagTallies[flag] <= 3
              ? result.t023FlagTallies[flag] : 0])
      )
    } : {}),
    ...(result?.caseId === 'T023' && result?.explanationDiagnostics ? {
      explanationDiagnostics: {
        noNewCostsFound: result.explanationDiagnostics.noNewCostsFound === true,
        approvedFound: result.explanationDiagnostics.approvedFound === true,
        falselyFinalFound: result.explanationDiagnostics.falselyFinalFound === true
      }
    } : {}),
    ...(result?.caseId === 'T013' && Array.isArray(result?.sampleCategories) ? {
      sampleCategories: result.sampleCategories.slice(0, 3).map(status => safe.has(status) ? status : 'NETWORK_OR_UNKNOWN'),
      sampleFieldScores: (Array.isArray(result.sampleFieldScores) ? result.sampleFieldScores : [])
        .slice(0, 3).map(score => Number.isInteger(score) && score >= 0 && score <= 10 ? score : 0),
      t013FlagTallies: Object.fromEntries(
        ['thresholdFound','immediateLegislatureFound','laterLegislatureFound','rejectedFound','confusedWith18Months']
          .map(flag => [flag,
            Number.isInteger(result.t013FlagTallies?.[flag]) &&
              result.t013FlagTallies[flag] >= 0 && result.t013FlagTallies[flag] <= 3
              ? result.t013FlagTallies[flag] : 0])
      )
    } : {}),
    ...(result?.caseId === 'T002' && result?.explanationDiagnostics ? {
      explanationDiagnostics: {
        topicFound: result.explanationDiagnostics.topicFound === true,
        definitivePhraseFound: result.explanationDiagnostics.definitivePhraseFound === true
      }
    } : {}),
    ...(result?.caseId === 'T009' && result?.explanationDiagnostics ? {
      explanationDiagnostics: {
        timingFound: result.explanationDiagnostics.timingFound === true,
        rejectedFound: result.explanationDiagnostics.rejectedFound === true
      }
    } : {}),
    ...(result?.caseId === 'T010' && result?.explanationDiagnostics ? {
      explanationDiagnostics: {
        secondLegislatureFound: result.explanationDiagnostics.secondLegislatureFound === true,
        rejectedFound: result.explanationDiagnostics.rejectedFound === true,
        wrong18MonthFound: result.explanationDiagnostics.wrong18MonthFound === true
      }
    } : {}),
    ...(result?.caseId === 'T011' && result?.explanationDiagnostics ? {
      explanationDiagnostics: {
        liabilitySubjectFound: result.explanationDiagnostics.liabilitySubjectFound === true,
        rejectedFound: result.explanationDiagnostics.rejectedFound === true,
        wrongFuelSubjectFound: result.explanationDiagnostics.wrongFuelSubjectFound === true
      }
    } : {}),
    ...(result?.caseId === 'T013' && result?.explanationDiagnostics ? {
      explanationDiagnostics: {
        thresholdFound: result.explanationDiagnostics.thresholdFound === true,
        immediateLegislatureFound: result.explanationDiagnostics.immediateLegislatureFound === true,
        laterLegislatureFound: result.explanationDiagnostics.laterLegislatureFound === true,
        rejectedFound: result.explanationDiagnostics.rejectedFound === true,
        confusedWith18Months: result.explanationDiagnostics.confusedWith18Months === true
      }
    } : {}),
    ...(result?.caseId === 'T012' && result?.explanationDiagnostics ? {
      explanationDiagnostics: {
        hotAreaFound: result.explanationDiagnostics.hotAreaFound === true,
        ilvaOrProgrammeFound: result.explanationDiagnostics.ilvaOrProgrammeFound === true,
        rejectedFound: result.explanationDiagnostics.rejectedFound === true
      }
    } : {}),
    ...(Number.isFinite(latency) && latency >= 0 ? { latencyMs: Math.min(120000, Math.round(latency)) } : {})
  };
}

async function runStartupQA({ env = process.env, runProbe = runOneProbe, runCases = runCaseSamples } = {}) {
  if (requestedCaseSamples(env) === 3) {
    // In stability mode, the authentic source-QA requests already verify
    // provider connectivity. Do not consume a fourth Free request on startup.
    const officialCase = await runCases({ env });
    const healthy = Number(officialCase?.samplesPassed) > 0;
    const probe = sanitizeResult({
      status: healthy ? 'OK' : officialCase?.status,
      success: healthy
    });
    return { probe, officialCase };
  }
  const probe = await runProbe({ env });
  const officialCase = probe.success ? await runCases({ env }) : {
    caseId: selectedCaseId(env), status: 'NOT_RUN', success: false, verifiedFields: 0
  };
  return { probe, officialCase };
}

function createHandler(getProbe, getCase = () => ({ status: 'NOT_RUN' })) {
  return (req, res) => {
    const path = String(req.url || '').split('?')[0];
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET' && path === '/health') {
      res.writeHead(200);
      res.end(JSON.stringify({ service: 'demos-groq-free-probe', alive: true }));
      return;
    }
    if (req.method === 'GET' && path === '/health/groq') {
      const result = sanitizeResult(getProbe());
      res.writeHead(result.success ? 200 : 503);
      res.end(JSON.stringify(result));
      return;
    }
    if (req.method === 'GET' && path === '/health/case') {
      const result = sanitizeCaseResult(getCase());
      res.writeHead(result.success ? 200 : 503);
      res.end(JSON.stringify(result));
      return;
    }
    res.writeHead(404);
    res.end(JSON.stringify({ status: 'NOT_FOUND' }));
  };
}

if (require.main === module) {
  let probe = { status: 'PENDING', success: false };
  let officialCase = { caseId: ['T002', 'T003', 'T006', 'T009', 'T010', 'T011', 'T012', 'T013', 'T018', 'T023'].includes(process.env.GROQ_QA_CASE_ID) ? process.env.GROQ_QA_CASE_ID : 'T008', status: 'PENDING', success: false, verifiedFields: 0 };
  const server = http.createServer(createHandler(() => probe, () => officialCase));
  server.listen(Number(process.env.PORT) || 10000, '0.0.0.0', () => {
    console.log('Standalone Groq Free probe listening; no DB or push initialized');
  });
  // Single-case mode retains the historical smoke, stability mode uses
  // only its three authenticated case requests. All endpoints remain read-only.
  void runStartupQA().then(result => {
    probe = result.probe;
    officialCase = result.officialCase;
  }).catch(() => {
    probe = { status: 'NETWORK_OR_UNKNOWN', success: false };
    officialCase = { caseId: selectedCaseId(), status: 'NETWORK_OR_UNKNOWN', success: false, verifiedFields: 0 };
  });
}

module.exports = { sanitizeResult, sanitizeCaseResult, runOneProbe, requestedCaseSamples, runCaseSamples, runStartupQA, createHandler };
