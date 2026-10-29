import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = file => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');

test('government confidence data is isolated per account and read uses abortable fetch', () => {
  const s = read('pages/Governo/hooks/useConsensoGovernoData.ts');
  assert.ok(s.includes("queryKey: ['consensoGovernoData', user?.id]"));
  assert.ok(s.includes('queryFn: async ({ signal }) => {'));
  assert.ok(s.includes('apiRequest("GET", "/api/governo/consenso", undefined, undefined, signal)'));
  assert.ok(s.includes('enabled: !!user?.id'));
});

test('minister preference page cache is account-scoped and abortable too', () => {
  const s = read('pages/Governo/hooks/useGovernoData.ts');
  assert.ok(s.includes("queryKey: ['governoVoti', user?.id]"));
  assert.ok(s.includes('queryFn: async ({ signal }) => {'));
  assert.ok(s.includes('apiRequest("GET", "/api/governo/voti", undefined, undefined, signal)'));
  assert.ok(s.includes('enabled: !!user?.id'));
});

test('revocation cancels and removes both government caches before notification', () => {
  const gdpr = read('pages/GDPR/index.tsx');
  const body = gdpr.slice(gdpr.indexOf('const revokeConsentMutation'), gdpr.indexOf('const handleDownloadData'));
  for (const key of ['consensoGovernoData', 'governoVoti']) {
    const cancel = body.indexOf("queryClient.cancelQueries({ queryKey: ['" + key + "'] })");
    const remove = body.indexOf("queryClient.removeQueries({ queryKey: ['" + key + "'] })");
    const notice = body.indexOf('title: "Consenso revocato"');
    assert.ok(cancel >= 0, key + ' cancellation missing');
    assert.ok(remove > cancel, key + ' cache must be removed after cancel');
    assert.ok(notice > remove, key + ' cache must be cleared before success notice');
  }
});
