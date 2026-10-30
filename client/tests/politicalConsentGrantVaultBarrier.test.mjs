import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../src/components/PoliticalOpinionsConsentModal.tsx', import.meta.url), 'utf8');
const ts = createRequire(new URL('../package.json', import.meta.url))('typescript');

// Execute the real TSX component's mutation callback with synthetic hooks and
// an intentionally blocked IndexedDB wipe. No account, network or DB is used.
function loadConsentMutation(queryClient, clearVault, events) {
  const compiled = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
  }).outputText;
  let config;
  const module = { exports: {} };
  const requireStub = (id) => {
    if (id === 'react') return { useState: (initial) => [initial, () => {}] };
    if (id === 'react/jsx-runtime') return { jsx: () => ({}), jsxs: () => ({}) };
    if (id === '@tanstack/react-query') return {
      useMutation: (mutation) => { config = mutation; return { isPending: false, mutate: () => {} }; },
      useQueryClient: () => queryClient,
    };
    if (id === '@/hooks/use-auth') return { useAuth: () => ({ user: { id: 'synthetic-owner' } }) };
    if (id === '@/lib/auth-token') return { getAuthToken: () => 'synthetic-token' };
    if (id === '@/pages/Profilo/utils/encryptedProfileVault') return { clearAllEncryptedProfiles: clearVault };
    if (id === '@/hooks/use-toast') return { useToast: () => ({ toast: () => events.push('toast') }) };
    if (id === 'wouter') return { Link: () => null };
    // Icons and UI elements are not rendered by this isolated hook test.
    return new Proxy({}, { get: () => () => null });
  };
  runInNewContext(compiled, { module, exports: module.exports, require: requireStub }, {
    filename: 'PoliticalOpinionsConsentModal.tsx (synthetic)',
  });
  module.exports.PoliticalOpinionsConsentModal({
    open: true,
    onOpenChange: () => events.push('close'),
    onConsentGranted: () => events.push('granted'),
  });
  assert.ok(config?.onSuccess, 'The real consent mutation must be captured');
  return config;
}

test('grant cancels prior-epoch reads and awaits encrypted wipe before navigation', async () => {
  const events = [];
  const pendingCancels = [];
  let finishVault;
  let authUpdateCount = 1;
  const queryClient = {
    getQueryState: () => ({ dataUpdateCount: authUpdateCount }),
    getQueryData: () => ({
      id: 'synthetic-owner',
      political_consent: { granted: true, timestamp: 'verified-epoch' },
    }),
    refetchQueries: async ({ queryKey }) => {
      events.push('refetch:' + queryKey[0]);
      authUpdateCount++;
    },
    setQueryData: () => {},

    cancelQueries: ({ queryKey }) => new Promise((resolve) => {
      events.push('cancel:' + queryKey[0]);
      pendingCancels.push(resolve);
    }),
    removeQueries: ({ queryKey }) => events.push('remove:' + queryKey[0]),
    invalidateQueries: ({ queryKey }) => { events.push('invalidate:' + queryKey[0]); return Promise.resolve(); },
  };
  const clearVault = () => new Promise((resolve) => {
    events.push('vault:start');
    finishVault = resolve;
  });
  const mutation = loadConsentMutation(queryClient, clearVault, events);
  const completion = mutation.onSuccess({ success: true });

  assert.equal(pendingCancels.length, 4, 'All personal read families must be cancelled');
  assert.equal(events.some((x) => x.startsWith('remove:')), false);
  assert.equal(events.includes('vault:start'), false);
  assert.equal(events.includes('granted'), false);
  pendingCancels.forEach((resolve) => resolve());
  // The TSX callback runs in a separate VM realm: let its Promise.all
  // continuation drain on the event loop rather than assuming two ticks.
  await new Promise((resolve) => setImmediate(resolve));

  assert.equal(events.filter((x) => x.startsWith('remove:')).length, 4);
  assert.equal(events.includes('vault:start'), true);
  assert.equal(events.includes('granted'), false, 'No navigation while encrypted wipe is pending');
  assert.equal(events.includes('toast'), false, 'Do not announce success before local privacy barrier');
  finishVault();
  await completion;
  assert.ok(events.indexOf('vault:start') < events.indexOf('granted'));
  assert.ok(events.indexOf('granted') < events.indexOf('close'));
  assert.ok(events.indexOf('refetch:user') < events.indexOf('granted'));
});

test('consent grant does not use fire-and-forget encrypted deletion', () => {
  assert.doesNotMatch(source, /void\s+clearAllEncryptedProfiles\s*\(/);
  assert.match(source, /onSuccess:\s*async\s*\(/);
  assert.match(source, /await\s+clearAllEncryptedProfiles\s*\(/);
});

test('consent dialog does not promise unverified complete deletion of backups', () => {
  assert.doesNotMatch(source, /eliminate completamente/);
  assert.match(source, /copie di sicurezza seguono procedure distinte/);
});
