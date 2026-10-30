import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const clientRequire = createRequire(new URL('../package.json', import.meta.url));
const ts = clientRequire('typescript');
const { QueryClient } = clientRequire('@tanstack/react-query');
const apiSource = readFileSync(new URL('../src/lib/queryClient.ts', import.meta.url), 'utf8');

// Compile the ACTUAL TypeScript API client. Replace only module dependencies
// and network interfaces with synthetic local test doubles; never use DEMOS.
function loadApiClient(fetchStub) {
  const compiled = ts.transpileModule(apiSource, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
  }).outputText;
  const module = { exports: {} };
  let nextTimer = 0;
  const liveTimers = new Set();
  const requireStub = (id) => {
    if (id === '@tanstack/react-query') return { QueryClient };
    if (id === '@/lib/api-config') return { getApiUrl: (url) => url };
    if (id === '@/lib/auth-token') return { getAuthToken: () => 'synthetic-token' };
    if (id === '@/pages/Profilo/utils/encryptedProfileVault') return {
      clearAllEncryptedProfiles: async () => {},
      invalidateEncryptedProfileSections: async () => {},
    };
    if (id === '@/pages/Profilo/utils/profileSummaryCache') return {
      clearAllProfileSummaries: () => {}, clearProfileSummary: () => {},
    };
    if (id === '@/lib/profileMutationPolicy') return {
      profileMutationImpact: () => null,
    };
    throw Error('Unexpected test module: ' + id);
  };
  runInNewContext(compiled, {
    module, exports: module.exports, require: requireStub, fetch: fetchStub,
    AbortController, URLSearchParams,
    setTimeout: () => { const id = ++nextTimer; liveTimers.add(id); return id; },
    clearTimeout: (id) => { liveTimers.delete(id); }, console
  }, { filename: 'queryClient.ts (synthetic TypeScript runtime)' });
  return { apiRequest: module.exports.apiRequest, liveTimers };
}

function abortError() {
  return Object.assign(new Error('Synthetic fetch cancelled'), { name: 'AbortError' });
}

test('React Query cancellation aborts the actual HTTP request and discards its cache', async () => {
  let started;
  const begun = new Promise(resolve => { started = resolve; });
  let httpSignal;
  const fetchStub = (_url, options) => {
    httpSignal = options.signal;
    return new Promise((resolve, reject) => {
      options.signal.addEventListener('abort', () => reject(abortError()), { once: true });
      started();
    });
  };
  const { apiRequest, liveTimers } = loadApiClient(fetchStub);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const key = ['opinioniQuestions', 'Nazionale', 'synthetic-user'];
  const request = queryClient.fetchQuery({
    queryKey: key,
    queryFn: ({ signal }) =>
      apiRequest('GET', '/api/opinioni-list?grado=N', undefined, undefined, signal)
  }).then(() => 'resolved', () => 'cancelled');
  await begun;
  assert.equal(httpSignal.aborted, false);
  await queryClient.cancelQueries({ queryKey: ['opinioniQuestions'] });
  queryClient.removeQueries({ queryKey: ['opinioniQuestions'] });
  assert.equal(await request, 'cancelled');
  assert.equal(httpSignal.aborted, true, 'The browser fetch itself must abort');
  assert.equal(queryClient.getQueryData(key), undefined, 'No personal answers may reappear');
  assert.equal(liveTimers.size, 0, 'HTTP timeout must be cleared');
  queryClient.clear();
});

test('an already-revoked external signal prevents the request and is not misreported as a timeout', async () => {
  let attempted = false;
  const fetchStub = (_url, options) => {
    attempted = true;
    assert.equal(options.signal.aborted, true);
    return Promise.reject(abortError());
  };
  const { apiRequest, liveTimers } = loadApiClient(fetchStub);
  const external = new AbortController();
  external.abort();
  await assert.rejects(
    apiRequest('GET', '/api/opinioni-list?grado=N', undefined, undefined, external.signal),
    (error) => error.name === 'AbortError'
  );
  assert.equal(attempted, true);
  assert.equal(liveTimers.size, 0, 'Aborted request must not leak timeout');
});

test('an un-cancelled response still returns normally and clears timeout', async () => {
  const fetchStub = async () => ({
    ok: true, status: 200,
    text: async () => JSON.stringify({ success: true, data: [{ id: 'synthetic' }] })
  });
  const { apiRequest, liveTimers } = loadApiClient(fetchStub);
  const response = await apiRequest('GET', '/api/opinioni-list?grado=N');
  assert.equal(response.ok, true);
  assert.equal(response.data.data[0].id, 'synthetic');
  assert.equal(liveTimers.size, 0);
});
