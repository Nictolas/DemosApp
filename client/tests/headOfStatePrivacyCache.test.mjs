import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = path => readFileSync(new URL('../src/' + path, import.meta.url), 'utf8');

test('Capo di Stato query is isolated per account and abortable at HTTP level', () => {
  const source = read('pages/CapodiStato/hooks/useCapoStatoData.ts');
  assert.ok(source.includes("queryKey: ['capoStatoData', user?.id]"));
  assert.match(source, /queryFn: async \(\{ signal \}\) => \{/);
  assert.ok(source.includes('apiRequest("GET", "/api/capo-stato", undefined, undefined, signal)'));
});

test('revocation cancels and removes cached Capo di Stato votes before showing success', () => {
  const source = read('pages/GDPR/index.tsx');
  const body = source.slice(source.indexOf('const revokeConsentMutation'), source.indexOf('const handleDownloadData'));
  const cancel = body.indexOf("queryClient.cancelQueries({ queryKey: ['capoStatoData'] })");
  const remove = body.indexOf("queryClient.removeQueries({ queryKey: ['capoStatoData'] })");
  const confirmed = body.indexOf('title: "Consenso revocato"');
  assert.ok(cancel >= 0, 'in-flight political requests must be cancelled');
  assert.ok(remove > cancel, 'cancel must precede removal');
  assert.ok(confirmed > remove, 'purge must precede success notification');
});

test('Capo di Stato mutation does not print personal choices or response data to console', () => {
  const source = read('pages/CapodiStato/hooks/useCapoStatoVoting.ts');
  assert.equal(source.includes('console.log('), false);
  assert.equal(source.includes('console.error('), false);
});
