'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runOneProbe, createHandler, sanitizeResult, sanitizeCaseResult, requestedCaseSamples, runCaseSamples, runStartupQA } = require('../staging/groq_free_standalone_probe');

test('three-sample startup never performs the redundant connectivity request', async () => {
  let smokeCalls = 0;
  let caseCalls = 0;
  const result = await runStartupQA({
    env: { GROQ_QA_CASE_ID: 'T006', GROQ_QA_REPEATS: '3' },
    runProbe: async () => { smokeCalls++; throw new Error('redundant smoke'); },
    runCases: async () => {
      caseCalls++;
      return {
        caseId: 'T006', status: 'OK', success: true, verifiedFields: 10,
        failedFields: [], samplesRequested: 3, samplesCompleted: 3, samplesPassed: 3
      };
    }
  });
  assert.equal(smokeCalls, 0);
  assert.equal(caseCalls, 1);
  assert.deepEqual(result.probe, { status: 'OK', success: true });
  assert.equal(result.officialCase.samplesPassed, 3);
});

test('single-sample startup retains the independent provider connectivity smoke', async () => {
  let smokeCalls = 0;
  let caseCalls = 0;
  const result = await runStartupQA({
    env: { GROQ_QA_CASE_ID: 'T006' },
    runProbe: async () => { smokeCalls++; return { status: 'OK', success: true }; },
    runCases: async () => {
      caseCalls++;
      return { caseId: 'T006', status: 'OK', success: true, verifiedFields: 10 };
    }
  });
  assert.equal(smokeCalls, 1);
  assert.equal(caseCalls, 1);
  assert.equal(result.officialCase.caseId, 'T006');
});

test('quota refusals in stability mode do not report healthy provider without a passing sample', async () => {
  const result = await runStartupQA({
    env: { GROQ_QA_CASE_ID: 'T006', GROQ_QA_REPEATS: '3' },
    runProbe: async () => { throw new Error('must not smoke'); },
    runCases: async () => ({
      caseId: 'T006', status: 'FREE_QUOTA_UNAVAILABLE', success: false,
      verifiedFields: 0, failedFields: [],
      samplesRequested: 3, samplesCompleted: 1, samplesPassed: 0
    })
  });
  assert.deepEqual(result.probe, { status: 'FREE_QUOTA_UNAVAILABLE', success: false });
});

test('T013 diagnostic tallies expose only safe categories and bounded counts', async () => {
  let calls = 0;
  const result = await runCaseSamples({
    env: { GROQ_QA_REPEATS: '3', GROQ_QA_CASE_ID: 'T013' },
    runCase: async () => {
      calls++;
      return {
        caseId: 'T013', status: 'SOURCE_MISMATCH', success: false,
        verifiedFields: calls === 3 ? 0 : 9,
        failedFields: ['spiegazione'],
        explanationDiagnostics: {
          thresholdFound: true, immediateLegislatureFound: calls !== 1,
          laterLegislatureFound: calls !== 3, rejectedFound: true,
          confusedWith18Months: false, rawGeneratedText: 'SECRET_GENERATION'
        }
      };
    }
  });
  assert.equal(calls, 3);
  const safe = sanitizeCaseResult(result);
  assert.deepEqual(safe.sampleCategories,
    ['SOURCE_MISMATCH','SOURCE_MISMATCH','SOURCE_MISMATCH']);
  assert.deepEqual(safe.sampleFieldScores, [9,9,0]);
  assert.deepEqual(safe.t013FlagTallies, {
    thresholdFound: 3, immediateLegislatureFound: 2,
    laterLegislatureFound: 2, rejectedFound: 3, confusedWith18Months: 0
  });
  assert.doesNotMatch(JSON.stringify(safe), /SECRET_GENERATION|rawGeneratedText/);
});

test('three source mismatches are reported as SOURCE_MISMATCH, not a transport failure', async () => {
  const qa = {
    caseId: 'T013', status: 'SOURCE_MISMATCH', success: false,
    verifiedFields: 9, failedFields: ['spiegazione'],
    samplesRequested: 3, samplesCompleted: 3, samplesPassed: 0
  };
  const startup = await runStartupQA({
    env: { GROQ_QA_REPEATS: '3', GROQ_QA_CASE_ID: 'T013' },
    runProbe: async () => { throw Error('should skip extra Free smoke'); },
    runCases: async () => qa
  });
  assert.deepEqual(startup.probe, { status: 'SOURCE_MISMATCH', success: false });
  assert.equal(sanitizeCaseResult(startup.officialCase).samplesPassed, 0);
});

test('stability QA defaults to one request and caps opt-in to three', async () => {
  assert.equal(requestedCaseSamples({}), 1);
  assert.equal(requestedCaseSamples({ GROQ_QA_REPEATS: '999' }), 1);
  assert.equal(requestedCaseSamples({ GROQ_QA_REPEATS: '3' }), 3);
  let calls = 0;
  const result = await runCaseSamples({
    env: { GROQ_QA_CASE_ID: 'T006', GROQ_QA_REPEATS: '3' },
    runCase: async () => {
      calls++;
      return {
        caseId: 'T006', status: 'OK', success: true, verifiedFields: 10,
        failedFields: [], rawProviderText: 'NEVER_LEAK'
      };
    }
  });
  assert.equal(calls, 3);
  assert.deepEqual(result, {
    caseId: 'T006', status: 'OK', success: true, verifiedFields: 10,
    failedFields: [], samplesRequested: 3, samplesCompleted: 3, samplesPassed: 3
  });
  assert.deepEqual(sanitizeCaseResult(result).samplesPassed, 3);
  assert.doesNotMatch(JSON.stringify(result), /NEVER_LEAK/);
});

test('stability QA rejects variable 9/10 even if two other independent samples pass', async () => {
  let calls = 0;
  const result = await runCaseSamples({
    env: { GROQ_QA_CASE_ID: 'T006', GROQ_QA_REPEATS: '3' },
    runCase: async () => {
      calls++;
      return calls === 2
        ? { caseId: 'T006', status: 'SOURCE_MISMATCH', success: false, verifiedFields: 9, failedFields: ['spiegazione', 'PRIVATE'] }
        : { caseId: 'T006', status: 'OK', success: true, verifiedFields: 10, failedFields: [] };
    }
  });
  assert.equal(calls, 3);
  assert.equal(result.success, false);
  assert.equal(result.status, 'SOURCE_MISMATCH');
  assert.equal(result.verifiedFields, 9);
  assert.equal(result.samplesPassed, 2);
  assert.equal(result.samplesCompleted, 3);
  assert.deepEqual(sanitizeCaseResult(result).failedFields, ['spiegazione']);
  assert.doesNotMatch(JSON.stringify(sanitizeCaseResult(result)), /PRIVATE/);
});

test('stability QA stops after Free provider rate limit, not an automatic retry', async () => {
  let calls = 0;
  const result = await runCaseSamples({
    env: { GROQ_QA_CASE_ID: 'T006', GROQ_QA_REPEATS: '3' },
    runCase: async () => {
      calls++;
      return { caseId: 'T006', status: 'RATE_LIMIT', success: false, verifiedFields: 0 };
    }
  });
  assert.equal(calls, 1);
  assert.equal(result.status, 'RATE_LIMIT');
  assert.equal(result.success, false);
  assert.equal(result.samplesCompleted, 1);
  assert.equal(result.samplesPassed, 0);
});

test('T002 explanation diagnostics expose only validated booleans, not output', () => {
  const result = sanitizeCaseResult({
    caseId: 'T002', status: 'SOURCE_MISMATCH', success: false, verifiedFields: 9,
    failedFields: ['spiegazione', 'PRIVATE'],
    explanationDiagnostics: { topicFound: true, definitivePhraseFound: false, raw: 'PRIVATE' }
  });
  assert.deepEqual(result.failedFields, ['spiegazione']);
  assert.deepEqual(result.explanationDiagnostics, { topicFound: true, definitivePhraseFound: false });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|raw/);
});

test('no Groq key never attempts a provider request', async () => {
  let calls = 0;
  const result = await runOneProbe({
    env: {},
    check: async () => { calls++; throw new Error('should not run'); }
  });
  assert.deepEqual(result, { status: 'NOT_CONFIGURED', success: false });
  assert.equal(calls, 0);
});

test('valid Free provider response is sanitized, with only one check', async () => {
  let calls = 0;
  const result = await runOneProbe({
    env: { GROQ_API_KEY: 'fake-test-key', GROQ_MODEL: 'openai/gpt-oss-120b' },
    check: async () => { calls++; return {
      status: 'OK', success: true, model: 'private', secret: 'NEVER_RETURN'
    }; }
  });
  assert.deepEqual(result, { status: 'OK', success: true });
  assert.equal(calls, 1);
  assert.doesNotMatch(JSON.stringify(result), /NEVER_RETURN|private/);
});

test('errors, unexpected statuses and provider fields never leak', async () => {
  const bad = await runOneProbe({
    env: { GROQ_API_KEY: 'fake-test-key' },
    check: async () => { throw new Error('PRIVATE_SECRET'); }
  });
  assert.deepEqual(bad, { status: 'NETWORK_OR_UNKNOWN', success: false });
  assert.deepEqual(sanitizeResult({
    status: 'arbitrary provider exception PRIVATE_SECRET',
    success: true,
    key: 'NEVER_RETURN'
  }), { status: 'NETWORK_OR_UNKNOWN', success: false });
});

test('health endpoints never accept generation requests, only return minimal status', async () => {
  let probe = { status: 'NOT_CONFIGURED', success: false };
  const handler = createHandler(() => probe);
  const serve = (method, url) => {
    const res = {
      statusCode: null, headers: {},
      setHeader(k, v) { this.headers[k.toLowerCase()] = v; },
      writeHead(code) { this.statusCode = code; },
      end(str) { this.body = JSON.parse(str); }
    };
    handler({ method, url }, res);
    return res;
  };
  assert.equal(serve('GET', '/health').statusCode, 200);
  assert.deepEqual(serve('GET', '/health/groq').body,
    { status: 'NOT_CONFIGURED', success: false });
  assert.equal(serve('GET', '/health/groq').statusCode, 503);
  probe = { status: 'OK', success: true, model: 'NEVER_RETURN' };
  assert.deepEqual(serve('GET', '/health/groq').body, { status: 'OK', success: true });
  assert.equal(serve('GET', '/health/groq').statusCode, 200);
  assert.equal(serve('POST', '/health/groq').statusCode, 404);
  assert.equal(serve('GET', '/api/voti-camera/genera-spiegazioni').statusCode, 404);
  assert.equal(serve('GET', '/health/groq?GROQ_API_KEY=private').statusCode, 200);
  assert.equal(serve('GET', '/health/groq').headers['cache-control'], 'no-store');
});

test('T009 diagnostics exclude model response text, expose only two flags', () => {
  const result = sanitizeCaseResult({
    caseId: 'T009', status: 'SOURCE_MISMATCH', success: false, verifiedFields: 9,
    failedFields: ['spiegazione'], explanationDiagnostics: { timingFound: true, rejectedFound: false, text: 'PRIVATE_OUTPUT' }
  });
  assert.deepEqual(result.explanationDiagnostics, { timingFound: true, rejectedFound: false });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE_OUTPUT|text/);
});

test('T012 explanation diagnostics contain only boolean checks and no source/output', () => {
  const result = sanitizeCaseResult({
    caseId: 'T012', status: 'SOURCE_MISMATCH', success: false,
    verifiedFields: 9, failedFields: ['spiegazione', 'PRIVATE'],
    explanationDiagnostics: {
      hotAreaFound: true, ilvaOrProgrammeFound: true, rejectedFound: false,
      text: 'PRIVATE_PROVIDER_RESPONSE'
    }
  });
  assert.deepEqual(result.failedFields, ['spiegazione']);
  assert.deepEqual(result.explanationDiagnostics,
    { hotAreaFound: true, ilvaOrProgrammeFound: true, rejectedFound: false });
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE|text/);
});

test('T011 cross-DDL warning reports boolean flags, never explanation text', () => {
  const safe = sanitizeCaseResult({
    caseId: 'T011', status: 'SOURCE_MISMATCH', success: false,
    verifiedFields: 9, failedFields: ['spiegazione'],
    explanationDiagnostics: {
      liabilitySubjectFound: false, rejectedFound: true,
      wrongFuelSubjectFound: true, original: 'PRIVATE_SOURCE_TEXT'
    }
  });
  assert.deepEqual(safe.explanationDiagnostics, {
    liabilitySubjectFound: false, rejectedFound: true, wrongFuelSubjectFound: true
  });
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE_SOURCE_TEXT|original/);
});

test('T013 official ballot explanation diagnostics cannot leak generated prose', () => {
  const sanitized = sanitizeCaseResult({
    caseId: 'T013', status: 'SOURCE_MISMATCH', success: false,
    verifiedFields: 9, failedFields: ['spiegazione'],
    explanationDiagnostics: {
      thresholdFound: true, immediateLegislatureFound: false,
      laterLegislatureFound: true, rejectedFound: true,
      confusedWith18Months: false, text: 'PRIVATE_GENERATION'
    }
  });
  assert.deepEqual(sanitized.explanationDiagnostics, {
    thresholdFound: true, immediateLegislatureFound: false,
    laterLegislatureFound: true, rejectedFound: true,
    confusedWith18Months: false
  });
  assert.doesNotMatch(JSON.stringify(sanitized), /PRIVATE_GENERATION|text/);
});

test('T023 official article diagnostics never reveal generated text', () => {
  const safe = sanitizeCaseResult({
    caseId: 'T023', status: 'SOURCE_MISMATCH', success: false,
    verifiedFields: 9, failedFields: ['spiegazione'],
    explanationDiagnostics: {
      noNewCostsFound: true, approvedFound: false, falselyFinalFound: true,
      rawText: 'PRIVATE_MODEL_OUTPUT'
    }
  });
  assert.deepEqual(safe.explanationDiagnostics, {
    noNewCostsFound: true, approvedFound: false, falselyFinalFound: true
  });
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE_MODEL_OUTPUT|rawText/);
});

test('T023 aggregates only approved/invarianza boolean counts across real sample outcomes', async () => {
  let i = 0;
  const result = await runCaseSamples({
    env: { GROQ_QA_REPEATS: '3', GROQ_QA_CASE_ID: 'T023' },
    runCase: async () => {
      i += 1;
      return {
        caseId: 'T023', status: i === 1 ? 'OK' : 'SOURCE_MISMATCH',
        success: i === 1, verifiedFields: i === 1 ? 10 : 9,
        failedFields: i === 1 ? [] : ['spiegazione'],
        explanationDiagnostics: {
          noNewCostsFound: i !== 2, approvedFound: true, falselyFinalFound: false,
          output: 'SECRET_PROVIDER_PROSE'
        }
      };
    }
  });
  const safe = sanitizeCaseResult(result);
  assert.deepEqual(safe.t023SampleCategories, ['OK', 'SOURCE_MISMATCH', 'SOURCE_MISMATCH']);
  assert.deepEqual(safe.t023SampleScores, [10, 9, 9]);
  assert.deepEqual(safe.t023FlagTallies, {
    noNewCostsFound: 2, approvedFound: 3, falselyFinalFound: 0
  });
  assert.equal(result.samplesPassed, 1);
  assert.doesNotMatch(JSON.stringify(safe), /SECRET_PROVIDER_PROSE|output/);
});

test('T024 formal-coordination explanation diagnostics expose no generated text', () => {
  const safe = sanitizeCaseResult({
    caseId: 'T024', status: 'SOURCE_MISMATCH', success: false,
    verifiedFields: 9, failedFields: ['spiegazione'],
    explanationDiagnostics: {
      coordinationFound: true, referencesFound: false,
      approvedFound: true, falseFinalityFound: false,
      rawText: 'PRIVATE_MODEL_OUTPUT'
    }
  });
  assert.deepEqual(safe.explanationDiagnostics, {
    coordinationFound: true, referencesFound: false,
    approvedFound: true, falseFinalityFound: false
  });
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE_MODEL_OUTPUT|rawText/);
});

test('T024 per-sample coordination diagnostics are bounded and never include text', async () => {
  let n = 0;
  const result = await runCaseSamples({
    env: { GROQ_QA_REPEATS: '3', GROQ_QA_CASE_ID: 'T024' },
    runCase: async () => {
      n++;
      return {
        caseId: 'T024', status: 'SOURCE_MISMATCH', success: false,
        verifiedFields: 9, failedFields: ['spiegazione'],
        explanationDiagnostics: {
          coordinationFound: true, referencesFound: n === 3,
          approvedFound: true, falseFinalityFound: false,
          raw: 'PRIVATE_GENERATION'
        },
        actDiagnostics: {
          coordinationMarkerFound: n > 1, correctItemNumberFound: true,
          genericBillOnly: n === 1
        }
      };
    }
  });
  const safe = sanitizeCaseResult(result);
  assert.deepEqual(safe.t024SampleCategories,
    ['SOURCE_MISMATCH', 'SOURCE_MISMATCH', 'SOURCE_MISMATCH']);
  assert.deepEqual(safe.t024SampleScores, [9,9,9]);
  assert.deepEqual(safe.t024FlagTallies, {
    coordinationFound: 3, referencesFound: 1, approvedFound: 3,
    falseFinalityFound: 0, coordinationMarkerFound: 2,
    correctItemNumberFound: 3, genericBillOnly: 1
  });
  assert.doesNotMatch(JSON.stringify(safe), /PRIVATE_GENERATION|raw/);
});

test('standalone smoke has no database, Firebase, cron or secret output handlers', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'staging', 'groq_free_standalone_probe.js'), 'utf8');
  assert.doesNotMatch(src, /require\(['"]\.\.\/config\/database['"]\)|getPool\(|firebase-admin|sendEachForMulticast|cron\.schedule|setInterval\(/);
  assert.doesNotMatch(src, /console\.(?:log|warn|error)\([^\n]*GROQ_API_KEY|console\.(?:log|warn|error)\([^\n]*error/);
  assert.match(src, /checkGroqFreeConnectivity/);
});
