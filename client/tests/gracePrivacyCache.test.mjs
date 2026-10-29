import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = file => readFileSync(new URL('../src/' + file, import.meta.url), 'utf8');

test('Grazia React Query cache is account-scoped and cancellation reaches fetch', () => {
  const s = source('pages/Grazia/hooks/useGraziaData.ts');
  assert.ok(s.includes("queryKey: ['graziaData', user?.id]"));
  assert.match(s, /queryFn: async \(\{ signal \}\) => \{/);
  assert.ok(s.includes('apiRequest("GET", "/api/grazia", undefined, undefined, signal)'));
  assert.equal(s.includes('console.log'), false, 'No personal vote arrays or response bodies in logs');
});

test('revoking political consent cancels and purges Grazia caches before success', () => {
  const s = source('pages/GDPR/index.tsx');
  const mutation = s.slice(s.indexOf('const revokeConsentMutation'), s.indexOf('const handleDownloadData'));
  const cancel = mutation.indexOf("queryClient.cancelQueries({ queryKey: ['graziaData'] })");
  const remove = mutation.indexOf("queryClient.removeQueries({ queryKey: ['graziaData'] })");
  const notice = mutation.indexOf('title: "Consenso revocato"');
  assert.ok(cancel >= 0);
  assert.ok(remove > cancel);
  assert.ok(notice > remove);
});
