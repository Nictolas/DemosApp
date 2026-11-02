'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

test('public health route exposes liveness but not process metadata', () => {
  const router = require('../routes/health');
  const route = router.stack.find(layer => layer.route && layer.route.path === '/health');
  assert.ok(route, 'health route exists');
  const handler = route.route.stack[0].handle;
  let status;
  let body;
  handler({}, { json(value) { body = value; return this; }, status(value) { status = value; return this; } });
  assert.equal(status, undefined);
  assert.equal(body.success, true);
  assert.equal(body.status, 'ok');
  assert.equal(typeof body.timestamp, 'string');
  for (const field of ['memory', 'uptime', 'environment', 'pid', 'database', 'headers']) {
    assert.equal(Object.hasOwn(body, field), false, 'must not disclose ' + field);
  }
});

test('public root route retains API identity without process metadata', () => {
  const router = require('../routes/health');
  const route = router.stack.find(layer => layer.route && layer.route.path === '/');
  assert.ok(route);
  let body;
  route.route.stack[0].handle({}, { json(value) { body = value; } });
  assert.equal(body.success, true);
  assert.equal(body.message, 'Demos Community API');
  assert.equal(Object.hasOwn(body, 'memory'), false);
  assert.equal(Object.hasOwn(body, 'environment'), false);
});
