'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const http = require('node:http');
const express = require('express');

const appSource = fs.readFileSync(path.resolve(__dirname, '../app.js'), 'utf8');

function errorHandlersSource() {
  const start = appSource.indexOf('// Gestione errori 404');
  const end = appSource.indexOf('// Avvia sistema di audit logging', start);
  assert.ok(start >= 0 && end > start, '404 and global handlers must remain independently testable');
  return appSource.slice(start, end);
}

async function startIsolatedServer() {
  const app = express();
  const observed = { logs: [], errorEvents: [] };
  app.get('/throw-secret', (req, res, next) => {
    const failure = new Error('INTERNAL_SECRET_NEVER_PUBLIC');
    failure.code = 'INTERNAL_FAILURE';
    next(failure);
  });
  vm.runInNewContext(errorHandlersSource(), {
    app,
    logger: {
      logError(error, req, meta) {
        observed.errorEvents.push({
          code: error.code,
          method: req.method,
          meta: { ...meta }
        });
        return Promise.resolve();
      }
    },
    console: {
      error(...args) { observed.logs.push(args.map(String).join(' ')); }
    }
  });
  const server = await new Promise(resolve => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  return { server, observed };
}

function request(server, target) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: '127.0.0.1',
      port: server.address().port,
      path: target
    }, response => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', chunk => { body += chunk; });
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        text: body,
        json: JSON.parse(body)
      }));
    });
    req.on('error', reject);
  });
}

test('unmatched paths return generic 404, no URL reflection and no unsafe logging', async t => {
  const { server, observed } = await startIsolatedServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const result = await request(server, '/missing-user/PRIVATE_ID?q=SECRET_QUERY&token=SECRET_TOKEN');
  assert.equal(result.status, 404);
  assert.equal(result.headers['cache-control'], 'no-store');
  assert.equal(result.json.success, false);
  assert.equal(result.json.error, 'Route non trovata');
  assert.doesNotMatch(result.text, /PRIVATE_ID|SECRET_QUERY|SECRET_TOKEN|\/missing-user/);
  assert.deepEqual(observed.logs, []);
});

test('unexpected Express errors return generic 500 and only safe logging metadata', async t => {
  const { server, observed } = await startIsolatedServer();
  t.after(() => new Promise(resolve => server.close(resolve)));
  const result = await request(server, '/throw-secret?token=SECRET_QUERY');
  assert.equal(result.status, 500);
  assert.equal(result.json.success, false);
  assert.equal(result.json.error, 'Errore interno del server');
  assert.doesNotMatch(result.text, /SECRET_QUERY|INTERNAL_SECRET_NEVER_PUBLIC|INTERNAL_FAILURE/);
  assert.deepEqual(observed.logs, []);
  assert.equal(observed.errorEvents.length, 1);
  assert.equal(observed.errorEvents[0].method, 'GET');
  assert.equal(observed.errorEvents[0].meta.globalError, true);
  assert.equal(observed.errorEvents[0].meta.endpoint, undefined);
  assert.equal(observed.errorEvents[0].meta.method, 'GET');
});

test('public CORS handlers cannot log untrusted Origin values', () => {
  const start = appSource.indexOf('// CORS -');
  const end = appSource.indexOf('// Universal request/notification debug logger', start);
  assert.ok(start >= 0 && end > start);
  const corsSection = appSource.slice(start, end);
  assert.doesNotMatch(corsSection, /console\.(?:log|warn|error)\s*\(/);
});

test('global middleware never logs raw URL, error object or stack', () => {
  const source = errorHandlersSource();
  assert.doesNotMatch(source, /req\.originalUrl|error\.stack|console\.error\([^\n]*,\s*(?:error|logError)\b/);
  assert.doesNotMatch(source, /endpoint\s*:/);
});
