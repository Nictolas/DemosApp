'use strict';

// Standalone GROQ-02 provider smoke on a dedicated Render Free service.
// No DB, Firebase, scheduler, user records, or public text-generation route.
// This service performs one connectivity check and one source QA case per start.
// Its HTTP endpoints only expose sanitized status, never keys or model output.
const http = require('node:http');
const { checkGroqFreeConnectivity } = require('../services/groqFreeSmokeService');
const { runOfficialCaseQA } = require('./groq_official_case_qa');

const SAFE_STATUSES = new Set([
  'OK', 'NOT_CONFIGURED', 'MODEL_NOT_ALLOWED', 'FREE_QUOTA_UNAVAILABLE',
  'EMPTY_OR_TRUNCATED', 'UNEXPECTED_RESPONSE', 'AUTH', 'MODEL_NOT_FOUND',
  'INVALID_REQUEST', 'RATE_LIMIT', 'PROVIDER_UNAVAILABLE',
  'NETWORK_OR_UNKNOWN'
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

function sanitizeCaseResult(result) {
  const safe = new Set(['PENDING', 'OK', 'NOT_RUN', 'NOT_CONFIGURED', 'MODEL_NOT_ALLOWED', 'FREE_QUOTA_UNAVAILABLE', 'EMPTY_OR_TRUNCATED', 'INVALID_JSON', 'SOURCE_MISMATCH', 'AUTH', 'MODEL_NOT_FOUND', 'INVALID_REQUEST', 'RATE_LIMIT', 'PROVIDER_UNAVAILABLE', 'NETWORK_OR_UNKNOWN']);
  const status = safe.has(result?.status) ? result.status : 'NETWORK_OR_UNKNOWN';
  const count = Number(result?.verifiedFields);
  const latency = Number(result?.latencyMs);
  return {
    caseId: process.env.GROQ_QA_CASE_ID === 'T002' ? 'T002' : 'T008',
    status,
    success: status === 'OK' && result?.success === true,
    verifiedFields: Number.isInteger(count) ? Math.max(0, Math.min(10, count)) : 0,
    failedFields: Array.isArray(result?.failedFields) ? result.failedFields.filter(field => ['atto','data_voto','favorevoli','contrari','astenuti','esito','numero_legge','data_pubblicazione','data_entrata_in_vigore','spiegazione'].includes(field)).slice(0, 10) : [],
    ...(Number.isFinite(latency) && latency >= 0 ? { latencyMs: Math.min(120000, Math.round(latency)) } : {})
  };
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
  let officialCase = { caseId: process.env.GROQ_QA_CASE_ID === 'T002' ? 'T002' : 'T008', status: 'PENDING', success: false, verifiedFields: 0 };
  const server = http.createServer(createHandler(() => probe, () => officialCase));
  server.listen(Number(process.env.PORT) || 10000, '0.0.0.0', () => {
    console.log('Standalone Groq Free probe listening; no DB or push initialized');
  });
  // Exactly one connectivity check and one fixed official case if connectivity succeeds.
  // No timer, scheduler, retry loop, or client-supplied prompt.
  void runOneProbe().then(async result => {
    probe = result;
    officialCase = result.success ? await runOfficialCaseQA() : {
      caseId: process.env.GROQ_QA_CASE_ID === 'T002' ? 'T002' : 'T008', status: 'NOT_RUN', success: false, verifiedFields: 0
    };
  });
}

module.exports = { sanitizeResult, sanitizeCaseResult, runOneProbe, createHandler };
