import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';

const source = readFileSync(new URL('../src/lib/queryClient.ts', import.meta.url), 'utf8');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

function createHarness(fetchImpl) {
  const changes = [];
  class FakeQueryClient {
    invalidateQueries(args) { changes.push({ type: 'invalidate', key: args.queryKey }); return Promise.resolve(); }
    resetQueries(args) { changes.push({ type: 'reset', key: args.queryKey }); return Promise.resolve(); }
  }
  const module = { exports: {} };
  runInNewContext(compiled, {
    module,
    exports: module.exports,
    require(name) {
      if (name === '@tanstack/react-query') return { QueryClient: FakeQueryClient };
      if (name === '@/lib/api-config') return { getApiUrl: (path) => path };
      if (name === '@/lib/auth-token') return { getAuthToken: () => 'synthetic-token' };
      throw new Error('Unexpected module ' + name);
    },
    fetch: fetchImpl,
    AbortController,
    setTimeout,
    clearTimeout,
    URLSearchParams,
    console: { error() {}, log() {} },
  });
  return { apiRequest: module.exports.apiRequest, changes };
}

function success(body = { success: true }) {
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify(body),
  };
}

test('cancelling a profile query actually aborts the pending fetch', async () => {
  let observedSignal = null;
  const { apiRequest, changes } = createHarness((_url, options) => {
    observedSignal = options.signal;
    return new Promise((_resolve, reject) => {
      options.signal.addEventListener('abort', () => {
        const error = new Error('Cancelled by account change');
        error.name = 'AbortError';
        reject(error);
      }, { once: true });
    });
  });
  const controller = new AbortController();
  const request = apiRequest('GET', '/api/users/me', undefined, undefined, controller.signal);
  controller.abort();
  await assert.rejects(request, (error) => error.name === 'AbortError');
  assert.equal(observedSignal?.aborted, true);
  assert.equal(changes.length, 0);
});

test('a successful profile write invalidates memory cache without persistent storage', async () => {
  const calls = [];
  const { apiRequest, changes } = createHarness(async (url, options) => {
    calls.push({ url, method: options.method, cache: options.cache });
    return success();
  });
  await apiRequest('PUT', '/api/users/me', { comune_residenza: 'Synthetic' });
  assert.equal(calls[0].cache, 'no-store');
  assert.deepEqual(changes.map(x => ({ type: x.type, key: Array.from(x.key) })), [
    { type: 'invalidate', key: ['profileSnapshot'] },
  ]);
});

test('consent revocation immediately resets profile cache rather than retaining old answers', async () => {
  const { apiRequest, changes } = createHarness(async () => success());
  await apiRequest('PUT', '/api/user/political-opinions-consent/revoke');
  assert.deepEqual(changes.map(x => ({ type: x.type, key: Array.from(x.key) })), [
    { type: 'reset', key: ['profileSnapshot'] },
  ]);
});

test('reads and failed writes never invalidate the profile snapshot', async () => {
  const { apiRequest, changes } = createHarness(async (url, options) => {
    if (options.method === 'GET') return success();
    return {
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ success: false, error: 'Denied' }),
    };
  });
  await apiRequest('GET', '/api/users/me');
  await assert.rejects(() => apiRequest('PUT', '/api/users/me'), /Denied/);
  assert.equal(changes.length, 0);
});
