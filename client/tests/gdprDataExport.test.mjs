import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const require = createRequire(import.meta.url);
const { transformSync } = createRequire(require.resolve('vite/package.json'))('esbuild');
const compiled = transformSync(readFileSync(new URL('../src/lib/gdprDataExport.ts', import.meta.url), 'utf8'), {
  loader: 'ts', format: 'cjs', target: 'es2022',
}).code;

function harness(response, initialToken = 'synthetic-token', switchBeforeClick = false) {
  let token = initialToken;
  const calls = [];
  const downloads = [];
  const urls = [];
  const module = { exports: {} };
  const anchor = {
    href: '', download: '',
    click() { downloads.push({href: this.href, name: this.download}); },
    remove() { downloads.push('removed'); },
  };
  const mocks = {
    '@/lib/api-config': { getApiUrl(path) { return `https://synthetic-native.invalid/api${path.substring(4)}`; } },
    '@/lib/auth-token': { getAuthToken() { return token; } },
  };
  vm.runInNewContext(compiled, {
    module, exports: module.exports, Blob, AbortController, setTimeout, clearTimeout,
    fetch: async (...args) => {
      calls.push(args);
      return typeof response === 'function' ? response(() => { token = 'synthetic-new-account'; }) : response;
    },
    URL: {
      createObjectURL(blob) {
        urls.push(blob);
        if (switchBeforeClick) token = 'synthetic-new-account';
        return 'blob:synthetic-export';
      },
      revokeObjectURL(url) { urls.push(url); },
    },
    document: {createElement: () => anchor, body: {appendChild() {}}},
    require(name) { assert.ok(Object.hasOwn(mocks, name), `Unexpected dependency: ${name}`); return mocks[name]; },
  });
  return {api: module.exports, calls, downloads, urls, anchor};
}

test('JSON export uses configured API/session resolver and unwraps confirmed data preserving false/zero', async () => {
  const data = {user_profile: {premium: false}, voting_activity: {count: 0}};
  const h = harness(Response.json({success: true, data}));
  const blob = await h.api.requestGdprExport('json');
  assert.deepEqual(JSON.parse(await blob.text()), data);
  assert.equal(blob.type, 'application/json');
  const [url, options] = h.calls[0];
  assert.equal(url, 'https://synthetic-native.invalid/api/user/data-export?format=json');
  assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
  assert.equal(options.cache, 'no-store');
  assert.ok(options.signal instanceof AbortSignal);
});

test('CSV export downloads server CSV with no browser reserialization and releases its object URL', async () => {
  const csv = 'Sezione,Campo,Valore\nProfilo,premium,false\n';
  const h = harness(new Response(csv, {headers: {'content-type': 'text/csv; charset=utf-8'}}));
  await h.api.downloadGdprExport('csv');
  assert.equal(h.calls[0][0], 'https://synthetic-native.invalid/api/user/data-export?format=csv');
  assert.equal(await h.urls[0].text(), csv);
  assert.match(h.downloads[0].name, /^dati-personali-\d{4}-\d{2}-\d{2}\.csv$/);
  assert.equal(h.downloads[0].href, 'blob:synthetic-export');
  assert.equal(h.downloads[1], 'removed');
  assert.equal(h.urls[1], 'blob:synthetic-export');
});

test('missing session, HTTP failures, wrong content type and unconfirmed JSON never trigger a download', async () => {
  const unauthenticated = harness(Response.json({success: true, data: {}}), null);
  await assert.rejects(unauthenticated.api.downloadGdprExport('json'));
  assert.equal(unauthenticated.calls.length, 0);
  const cases = [
    ['json', new Response('synthetic-private-error', {status: 503})],
    ['json', new Response('<html>login</html>', {headers: {'content-type': 'text/html'}})],
    ['json', Response.json({success: false, data: {}})],
    ['json', Response.json({success: true, data: null})],
    ['csv', Response.json({error: 'synthetic-error'})],
    ['csv', new Response('', {headers: {'content-type': 'text/csv'}})],
  ];
  for (const [format, response] of cases) {
    const h = harness(response);
    await assert.rejects(h.api.downloadGdprExport(format), error => !error.message.includes('synthetic-private-error'));
    assert.equal(h.downloads.length, 0);
    assert.equal(h.urls.length, 0);
  }
});

test('changing session while reading JSON or CSV discards the response before download', async () => {
  for (const format of ['json', 'csv']) {
    const h = harness(changeAccount => ({
      ok: true,
      headers: new Headers({'content-type': format === 'json' ? 'application/json' : 'text/csv'}),
      async json() { changeAccount(); return {success: true, data: {user_profile: {id: 'synthetic-old-account'}}}; },
      async text() { changeAccount(); return 'synthetic-old-account'; },
    }));
    await assert.rejects(h.api.downloadGdprExport(format), /Sessione cambiata/);
    assert.equal(h.downloads.length, 0);
    assert.equal(h.urls.length, 0);
  }
});

test('a browser download failure still removes the anchor and revokes the object URL', async () => {
  const h = harness(Response.json({success: true, data: {user_profile: {}}}));
  h.anchor.click = () => { throw Error('Synthetic download failure'); };
  await assert.rejects(h.api.downloadGdprExport('json'), /Synthetic download failure/);
  assert.deepEqual(h.downloads, ['removed']);
  assert.equal(h.urls[1], 'blob:synthetic-export');
});

test('the session is checked again at the final browser-download boundary', async () => {
  const h = harness(Response.json({success: true, data: {user_profile: {}}}), 'synthetic-token', true);
  await assert.rejects(h.api.downloadGdprExport('json'), /Sessione cambiata/);
  assert.deepEqual(h.downloads, ['removed']);
  assert.equal(h.urls[1], 'blob:synthetic-export');
});
