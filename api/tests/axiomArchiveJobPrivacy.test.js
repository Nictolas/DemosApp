'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const jobPath = require.resolve('../jobs/axiomArchiveJob');

function loadFailingArchiveJob(failure) {
  const original = Module._load;
  try {
    Module._load = function (request, parent, isMain) {
      if (parent?.filename === jobPath && request === 'node-cron') {
        return { validate: () => true, schedule: () => ({ stop() {} }) };
      }
      if (parent?.filename === jobPath && request === '../services/axiomArchiveService') {
        return { AxiomArchiveService: class {
          async runOnce() { throw failure; }
        } };
      }
      return original.call(this, request, parent, isMain);
    };
    delete require.cache[jobPath];
    return require('../jobs/axiomArchiveJob');
  } finally {
    Module._load = original;
    delete require.cache[jobPath];
  }
}

test('known fixed archive failure codes remain useful and all free text is redacted', () => {
  const job = loadFailingArchiveJob(new Error('not started'));
  assert.equal(job.safeArchiveErrorCode(new Error('AXIOM_ARCHIVE_DELIVERY_ID_CONFLICT')),
    'AXIOM_ARCHIVE_DELIVERY_ID_CONFLICT');
  assert.equal(job.safeArchiveErrorCode(new Error('B2_OBJECT_MISSING')),
    'B2_OBJECT_MISSING');
  for (const message of [
    'request failed at https://storage.example/bucket?secret=test-only',
    'AXIOM_ARCHIVE_DENIED bearer secret',
    'ARCHIVE_file-name-123',
    'Bearer secret123', ''
  ]) {
    assert.equal(job.safeArchiveErrorCode(new Error(message)),
      'AXIOM_ARCHIVE_UNCLASSIFIED_FAILURE');
  }
});

test('failed real job path logs only sanitized codes, not provider secret or object keys', async () => {
  const failure = new Error('S3 error: https://example.test/bucket/object?token=TOP_SECRET');
  const job = loadFailingArchiveJob(failure);
  const logs = [];
  const previous = console.error;
  console.error = (...args) => logs.push(args.map(String).join(' '));
  try {
    await assert.rejects(job.runAxiomArchiveOnce(), e => e === failure);
  } finally {
    console.error = previous;
  }
  assert.deepEqual(logs, [
    'Axiom archive failed: AXIOM_ARCHIVE_UNCLASSIFIED_FAILURE'
  ]);
  assert.ok(!JSON.stringify(logs).includes('TOP_SECRET'));
  assert.ok(!JSON.stringify(logs).includes('/bucket/object'));
});
