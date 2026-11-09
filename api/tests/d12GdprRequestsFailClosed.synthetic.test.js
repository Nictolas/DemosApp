'use strict';
// Isolated verification: no database, email, external API, or actual DSAR.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../routes/user/gdpr-requests.js'), 'utf8');
const endpoints = new Map();
let databaseImports = 0;
const router = {
  get: (name, auth, handler) => endpoints.set('GET ' + name, { auth, handler }),
  post: (name, auth, handler) => endpoints.set('POST ' + name, { auth, handler }),
};
const verifyToken = (_req, _res, next) => next();
vm.runInNewContext(source, {
  module: { exports: {} },
  require: name => {
    if (name === 'express') return { Router: () => router };
    if (name === '../../middleware/auth') return { verifyToken };
    databaseImports++;
    throw new Error('Unexpected dependency: ' + name);
  },
}, { filename: 'gdpr-requests.js' });

function response() {
  return {
    code: 200, headers: {}, payload: null,
    set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
    status(value) { this.code = value; return this; },
    json(value) { this.payload = value; return this; },
  };
}

test('legacy GDPR requests must never falsely confirm a DSAR or expose submitted details', () => {
  assert.equal(databaseImports, 0, 'no unverified database access');
  assert.deepEqual(Array.from(endpoints.keys()).sort(), ['GET /', 'POST /']);
  for (const method of ['GET', 'POST']) {
    const endpoint = endpoints.get(method + ' /');
    assert.equal(endpoint.auth, verifyToken, 'authentication must be preserved');
    const res = response();
    endpoint.handler({ body: { tipo: 'cancellazione', dettagli: 'PRIVATE_TEST_SENTINEL' } }, res);
    assert.equal(res.code, 503, method + ' must fail closed');
    assert.equal(res.payload.success, false);
    assert.match(res.headers['cache-control'], /no-store/i);
    assert.match(res.payload.message, /privacy@demos\.community/);
    assert.ok(!JSON.stringify(res.payload).includes('PRIVATE_TEST_SENTINEL'));
    assert.ok(!JSON.stringify(res.payload).includes('pending'));
    if (method === 'POST') assert.match(res.payload.message, /non è stata registrata/);
  }
});
