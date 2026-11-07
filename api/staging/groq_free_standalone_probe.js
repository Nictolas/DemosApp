'use strict';

// Standalone GROQ-02 provider smoke on a dedicated Render Free service.
// No DB, Firebase, scheduler, user records, or public text-generation route.
// This service performs at most one provider check per process start.
// Its HTTP endpoints only expose sanitized status, never keys or model output.
const http = require('node:http');
const { checkGroqFreeConnectivity } = require('../services/groqFreeSmokeService');

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

function createHandler(getProbe) {
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
    res.writeHead(404);
    res.end(JSON.stringify({ status: 'NOT_FOUND' }));
  };
}

if (require.main === module) {
  let probe = { status: 'PENDING', success: false };
  const server = http.createServer(createHandler(() => probe));
  server.listen(Number(process.env.PORT) || 10000, '0.0.0.0', () => {
    console.log('Standalone Groq Free probe listening; no DB or push initialized');
  });
  // No timer, scheduler, retry loop, or client-supplied prompt.
  void runOneProbe().then(result => { probe = result; });
}

module.exports = { sanitizeResult, runOneProbe, createHandler };
