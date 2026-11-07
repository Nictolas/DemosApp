'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { runOneProbe, createHandler, sanitizeResult, sanitizeCaseResult, requestedCaseSamples, runCaseSamples } = require('../staging/groq_free_standalone_probe');

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

test('standalone smoke has no database, Firebase, cron or secret output handlers', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'staging', 'groq_free_standalone_probe.js'), 'utf8');
  assert.doesNotMatch(src, /require\(['"]\.\.\/config\/database['"]\)|getPool\(|firebase-admin|sendEachForMulticast|cron\.schedule|setInterval\(/);
  assert.doesNotMatch(src, /console\.(?:log|warn|error)\([^\n]*GROQ_API_KEY|console\.(?:log|warn|error)\([^\n]*error/);
  assert.match(src, /checkGroqFreeConnectivity/);
});
