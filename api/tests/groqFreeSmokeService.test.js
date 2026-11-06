'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { checkGroqFreeConnectivity } = require('../services/groqFreeSmokeService');

const config = { GROQ_API_KEY: 'gsk_TEST_NOT_A_REAL_KEY', GROQ_MODEL: 'openai/gpt-oss-120b' };

test('missing key and blocked model cannot call the provider', async () => {
  let called = false;
  const clientFactory = () => { called = true; throw new Error('must not call'); };
  assert.deepEqual(await checkGroqFreeConnectivity({ env: {}, clientFactory }),
    { success: false, status: 'NOT_CONFIGURED' });
  assert.deepEqual(await checkGroqFreeConnectivity({
    env: { ...config, GROQ_MODEL: 'llama-3.3-70b-versatile' }, clientFactory
  }), { success: false, status: 'MODEL_NOT_ALLOWED' });
  assert.equal(called, false);
});

test('a successful call proves response content but never returns it', async () => {
  let requests = 0;
  const result = await checkGroqFreeConnectivity({
    env: config,
    clientFactory: () => ({}),
    request: async (_client, params) => {
      requests++;
      assert.equal(params.model, config.GROQ_MODEL);
      assert.equal(params.max_completion_tokens, 512);
      assert.equal(params.reasoning_effort, 'low');
      assert.equal(params.messages.length, 2);
      return { choices: [{ finish_reason: 'stop', message: { content: 'OK' } }] };
    }
  });
  assert.equal(requests, 1);
  assert.deepEqual(result, { success: true, status: 'OK', model: config.GROQ_MODEL });
  assert.doesNotMatch(JSON.stringify(result), /gsk_|content|prompt|message/);
});

test('empty, filtered and truncated outputs never report success', async () => {
  for (const completion of [
    { choices: [] },
    { choices: [{ finish_reason: 'length', message: { content: 'unreliable partial' } }] },
    { choices: [{ finish_reason: 'content_filter', message: { content: 'filtered' } }] },
    { choices: [{ finish_reason: 'tool_calls', message: { content: 'untrusted tool output' } }] },
    { choices: [{ finish_reason: null, message: { content: 'untrusted partial' } }] },
    { choices: [{ message: { content: 'text without termination proof' } }] },
    { choices: [{ finish_reason: 'stop', message: { content: '' } }] }
  ]) {
    const result = await checkGroqFreeConnectivity({
      env: config, clientFactory: () => ({}), request: async () => completion
    });
    assert.equal(result.success, false);
    assert.equal(result.status, 'EMPTY_OR_TRUNCATED');
    assert.doesNotMatch(JSON.stringify(result), /partial|filtered|gsk_/);
  }
});

test('unrelated provider output cannot pass the Groq connectivity challenge', async () => {
  for (const answer of ['I cannot help with that', 'quota exceeded', 'OK but I cannot respond', 'not OK']) {
    const result = await checkGroqFreeConnectivity({
      env: config, clientFactory: () => ({}),
      request: async () => ({
        choices: [{ finish_reason: 'stop', message: { content: answer } }]
      })
    });
    assert.deepEqual(result, {
      success: false, status: 'UNEXPECTED_RESPONSE', model: config.GROQ_MODEL
    });
    assert.doesNotMatch(JSON.stringify(result), /quota exceeded|cannot help|not OK/i);
  }
  for (const answer of ['OK', ' OK ', 'Ok.', 'ok!']) {
    const result = await checkGroqFreeConnectivity({
      env: config, clientFactory: () => ({}),
      request: async () => ({
        choices: [{ finish_reason: 'stop', message: { content: answer } }]
      })
    });
    assert.equal(result.success, true);
    assert.equal(result.status, 'OK');
  }
});

test('quota denial and API errors return redacted status only', async () => {
  const limited = await checkGroqFreeConnectivity({
    env: config, clientFactory: () => ({}), request: async () => null
  });
  assert.equal(limited.status, 'FREE_QUOTA_UNAVAILABLE');

  for (const status of [401, 403, 404, 429, 500, 502]) {
    const fakeError = Object.assign(new Error('private gsk_TEST_NOT_A_REAL_KEY'), {
      status, stack: 'stack contains private gsk_TEST_NOT_A_REAL_KEY'
    });
    const result = await checkGroqFreeConnectivity({
      env: config, clientFactory: () => ({}), request: async () => { throw fakeError; }
    });
    assert.equal(result.success, false);
    assert.doesNotMatch(JSON.stringify(result), /private|gsk_|stack/i);
  }
});

test('diagnostic is admin-only, adds no parliamentary SQL, and returns 200 or 503', async () => {
  const source = fs.readFileSync(path.join(__dirname, '..', 'routes', 'voti-camera.js'), 'utf8');
  const begin = source.indexOf("// POST /api/voti-camera/groq-smoke");
  const end = source.indexOf("// POST /api/voti-camera/:politico/spiegazione");
  assert.ok(begin > 0 && end > begin);
  const block = source.slice(begin, end);
  assert.match(block, /router\.post\('\/groq-smoke', verifyToken, requireAdmin,/);
  const executable = block.split('\n').filter(line => !line.trimStart().startsWith('//')).join('\n');
  assert.doesNotMatch(executable, /pool\.|\.query\(|\.execute\(|\.insert\(|\b(?:UPDATE|INSERT|DELETE)\s+\w+/i);
  assert.doesNotMatch(block, /apiKey|GROQ_API_KEY|error\.message|error\.stack/);

  let diagnosticResult = { success: true, status: 'OK', model: config.GROQ_MODEL };
  let registered;
  const fakeRequire = (name) => {
    assert.equal(name, '../services/groqFreeSmokeService');
    return { checkGroqFreeConnectivity: async () => diagnosticResult };
  };
  vm.runInNewContext(block, {
    router: { post: (_route, _auth, _admin, handler) => { registered = handler; } },
    verifyToken: () => {}, requireAdmin: () => {}, require: fakeRequire
  });
  assert.equal(typeof registered, 'function');
  for (const [result, status] of [
    [{ success: true, status: 'OK' }, 200],
    [{ success: false, status: 'AUTH' }, 503]
  ]) {
    diagnosticResult = result;
    const res = {
      statusCode: 0,
      status(code) { this.statusCode = code; return this; },
      json(body) { this.body = body; return this; }
    };
    await registered({}, res);
    assert.equal(res.statusCode, status);
    assert.deepEqual({ ...res.body }, result);
  }
});
