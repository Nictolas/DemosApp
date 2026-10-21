const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeLevel, shouldWriteLogEvent } = require('../utils/logEventPolicy');

test('lowercase configured levels work for normal operational logs', () => {
  assert.equal(normalizeLevel('info'), 'INFO');
  assert.equal(normalizeLevel(' warn '), 'WARN');
  assert.equal(shouldWriteLogEvent('INFO', 'info'), true);
  assert.equal(shouldWriteLogEvent('DEBUG', 'info'), false);
  assert.equal(shouldWriteLogEvent('ERROR', 'warn'), true);
});

test('invalid verbosity safely defaults to INFO', () => {
  assert.equal(normalizeLevel('bad-setting'), 'INFO');
  assert.equal(shouldWriteLogEvent('INFO', 'bad-setting'), true);
  assert.equal(shouldWriteLogEvent('DEBUG', 'bad-setting'), false);
  assert.equal(shouldWriteLogEvent('UNSPECIFIED', 'INFO'), false);
});

test('security and audit records bypass verbose filtering only when marked explicitly', () => {
  assert.equal(shouldWriteLogEvent('INFO', 'ERROR', { auditEvent: true }), true);
  assert.equal(shouldWriteLogEvent('WARN', 'ERROR', { securityEvent: true }), true);
  assert.equal(shouldWriteLogEvent('INFO', 'ERROR', {}), false);
  assert.equal(shouldWriteLogEvent('INFO', 'ERROR', { auditEvent: 'true' }), false);
});
