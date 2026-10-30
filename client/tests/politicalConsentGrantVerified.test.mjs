import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';

const modalSource = readFileSync(
  new URL('../src/components/PoliticalOpinionsConsentModal.tsx', import.meta.url),
  'utf8',
);
const ts = createRequire(new URL('../package.json', import.meta.url))('typescript');
const js = ts.transpileModule(modalSource, {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
}).outputText;

function fixture(options = {}) {
  const events = [];
  let authToken = 'synthetic-token';
  let authUpdateCount = 1;
  let authUser = {
    id: 'synthetic-owner',
    political_consent: { granted: false, timestamp: null },
  };
  let mutation;
  let releaseVault;
  const vaultPromise = options.holdVault
    ? new Promise(resolve => { releaseVault = resolve; }) : null;
  const queryClient = {
    cancelQueries: async ({ queryKey }) => { events.push('cancel:' + queryKey[0]); },
    removeQueries: ({ queryKey }) => { events.push('remove:' + queryKey[0]); },
    getQueryState: ({ 0: a, 1: b }) => {
      assert.equal(a, 'user');
      assert.equal(b, 'synthetic-token');
      return { dataUpdateCount: authUpdateCount };
    },
    getQueryData: () => authUser,
    refetchQueries: async ({ queryKey, exact, type }) => {
      events.push('refetch:' + queryKey[0]);
      assert.equal(queryKey[1], 'synthetic-token');
      assert.equal(exact, true);
      assert.equal(type, 'active');
      if (options.refetchFails) return;
      if (!options.noQueryUpdate) authUpdateCount++;
      authUser = {
        id: options.otherOwner ? 'synthetic-other-owner' : 'synthetic-owner',
        political_consent: {
          granted: options.revoked ? false : true,
          timestamp: options.blankEpoch ? '' : 'verified-consent-epoch',
        },
      };
      if (options.changeToken) authToken = 'different-token';
    },
    setQueryData: (key, value) => {
      events.push('set-consent:' + key[1]);
      assert.equal(value.consent.timestamp, 'verified-consent-epoch');
    },
    invalidateQueries: ({ queryKey }) => {
      events.push('invalidate:' + queryKey[0]);
      return Promise.resolve();
    },
  };
  const clearVault = async () => {
    events.push('vault:start');
    if (vaultPromise) await vaultPromise;
    events.push('vault:end');
  };
  const apiRequest = async (method, path) => {
    events.push('api:' + method + ':' + path);
    return { ok: !options.postFails, data: { success: !options.postFails } };
  };
  const requireStub = (id) => {
    if (id === 'react') return { useState: value => [value, () => {}] };
    if (id === 'react/jsx-runtime') return { jsx: () => ({}), jsxs: () => ({}) };
    if (id === '@tanstack/react-query') return {
      useMutation: callbacks => {
        mutation = callbacks;
        return { isPending: false, mutate: () => {} };
      },
      useQueryClient: () => queryClient,
    };
    if (id === '@/lib/queryClient') return { apiRequest };
    if (id === '@/hooks/use-auth') return { useAuth: () => ({ user: { id: 'synthetic-owner' } }) };
    if (id === '@/lib/auth-token') return { getAuthToken: () => authToken };
    if (id === '@/pages/Profilo/utils/encryptedProfileVault') {
      return { clearAllEncryptedProfiles: clearVault };
    }
    if (id === '@/hooks/use-toast') return {
      useToast: () => ({ toast: () => events.push('toast') }),
    };
    if (id === 'wouter') return { Link: () => null };
    return new Proxy({}, { get: () => () => null });
  };
  const module = { exports: {} };
  runInNewContext(js, { module, exports: module.exports, require: requireStub });
  module.exports.PoliticalOpinionsConsentModal({
    open: true,
    onOpenChange: () => events.push('close'),
    onConsentGranted: () => events.push('granted'),
  });
  return { events, mutation, releaseVault };
}

test('after grant the vault barrier and fresh auth/me must finish before callback', async () => {
  const f = fixture({ holdVault: true });
  const pending = f.mutation.onSuccess({ success: true });
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(f.events.includes('vault:start'));
  assert.ok(!f.events.includes('vault:end'));
  assert.ok(!f.events.includes('granted'));
  assert.ok(!f.events.some(x => x.startsWith('refetch:')));
  f.releaseVault();
  await pending;
  assert.ok(f.events.indexOf('vault:end') < f.events.indexOf('refetch:user'));
  assert.ok(f.events.indexOf('refetch:user') < f.events.indexOf('set-consent:synthetic-owner'));
  assert.ok(f.events.indexOf('set-consent:synthetic-owner') < f.events.indexOf('granted'));
  assert.ok(f.events.indexOf('granted') < f.events.indexOf('close'));
  assert.equal(f.events.filter(x => x.startsWith('api:GET')).length, 0);
});

for (const [label, options] of [
  ['failed auth refresh', { refetchFails: true }],
  ['new auth query did not complete', { noQueryUpdate: true }],
  ['re-verified revoked consent', { revoked: true }],
  ['blank consent epoch', { blankEpoch: true }],
  ['another owner logged in', { otherOwner: true }],
  ['auth token changed', { changeToken: true }],
]) {
  test('pending answers are never saved after ' + label, async () => {
    const f = fixture(options);
    await assert.rejects(f.mutation.onSuccess({ success: true }), /Consenso registrato/);
    assert.ok(!f.events.includes('granted'));
    assert.ok(!f.events.includes('close'));
    assert.ok(!f.events.includes('toast'));
  });
}

test('unsuccessful consent POST is not accepted as a grant', async () => {
  const f = fixture({ postFails: true });
  await assert.rejects(f.mutation.mutationFn(true), /non ha confermato/);
});

test('all opinion editors defer pending save until the verified owner and epoch are ready', () => {
  const categories = ['Comunali', 'Europee', 'Nazionali', 'Regionali'];
  for (const category of categories) {
    const source = readFileSync(
      new URL('../src/pages/Opinioni' + category + '.tsx', import.meta.url),
      'utf8',
    );
    assert.match(source, /pendingOpinionsToSave\.ownerId !== user\?\.id/);
    assert.match(source, /isSessionVerified && verifiedPoliticalConsent\?\.granted !== true/);
    assert.match(source, /!isSessionVerified \|\| !hasConsent \|\| !canReadOpinions/);
    assert.match(source, /setGrantConfirmed\(true\)/);
    // New users must be able to reach the optional consent form without
    // fetching political answers before authorization.
    assert.match(source, /enabled: !!user && isSessionVerified && hasConsent/);
    assert.match(source, /const canReadOpinions = !!user && isSessionVerified && hasConsent/);
    assert.match(source, /isSessionVerified && !hasConsent \? \(/);
    assert.match(source, /onClick=\{\(\) => setShowConsentDialog\(true\)\}/);
    assert.match(source, /Leggi e scegli se dare il consenso/);
    assert.match(source, /if \(pendingOpinionsToSave\) setGrantConfirmed\(true\)/);
    // A completed POST must never write a cache entry for a different login.
    assert.match(source, /const savedSession = captureOpinionSaveSession\(/);
    assert.match(source, /if \(!savedSession\) \{/);
    assert.match(source, /matchesOpinionSaveSession\(/);
    assert.match(source, /if \(!stillCurrent\(\)\) return/);
    assert.match(source, /cacheConfirmedOpinionAnswers\(savedSession\.ownerId, savedSession\.consentEpoch/);
    assert.doesNotMatch(source, /cacheConfirmedOpinionAnswers\(user!\.id/);
    // The selected pending answer must survive the post-grant category reload.
    assert.match(source, /\.\.\.opinions, \.\.\.pendingOpinionsToSave\.answers/);
    // Failed POST must leave the selected answers in React state for a retry.
    assert.match(source, /setOpinions\(\(previous\) => \(\{ \.\.\.previous, \.\.\.toSave \}\)\)/);
    assert.ok(source.indexOf('setOpinions((previous) => ({ ...previous, ...toSave }))') <
      source.indexOf('saveMutation.mutate(toSave)'), category);
    assert.doesNotMatch(source, /refetchQueries\(\{\s*queryKey:\s*\['political-opinions-consent'\]/);
    assert.doesNotMatch(source, /saveMutation\.mutate\(pendingOpinionsToSave\)/);
  }
});

test('consent mutation does not automatically issue redundant dedicated consent GET', () => {
  assert.doesNotMatch(modalSource, /invalidateQueries\(\{\s*queryKey:\s*\['political-opinions-consent'\]/);
  assert.match(modalSource, /refetchQueries\(\{\s*queryKey:\s*authKey/);
});

const saveSessionSource = readFileSync(
  new URL('../src/lib/opinionSaveSession.ts', import.meta.url), 'utf8',
);
const saveSessionJs = ts.transpileModule(saveSessionSource, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const saveSessionModule = { exports: {} };
runInNewContext(saveSessionJs, {
  module: saveSessionModule, exports: saveSessionModule.exports,
});
const { captureOpinionSaveSession, matchesOpinionSaveSession } = saveSessionModule.exports;

const consentUser = (id = 'owner-a', epoch = 'epoch-a', granted = true) => ({
  id, political_consent: { granted, timestamp: epoch },
});

test('opinion save binds the verified owner, token and consent epoch in RAM', () => {
  const started = captureOpinionSaveSession('owner-a', 'epoch-a', 'token-a', consentUser());
  assert.equal(started?.ownerId, 'owner-a');
  assert.equal(started?.consentEpoch, 'epoch-a');
  assert.equal(started?.token, 'token-a');
  assert.equal(matchesOpinionSaveSession(started, 'token-a', consentUser()), true);
});

test('a different login cannot receive an old save ACK in the local cache', () => {
  const started = captureOpinionSaveSession('owner-a', 'epoch-a', 'token-a', consentUser());
  assert.equal(matchesOpinionSaveSession(started, 'token-b', consentUser()), false);
  assert.equal(matchesOpinionSaveSession(started, 'token-a', consentUser('owner-b')), false);
  assert.equal(matchesOpinionSaveSession(started, 'token-a', null), false);
});

test('revocation and consent renewal invalidate pending save acknowledgements', () => {
  const started = captureOpinionSaveSession('owner-a', 'epoch-a', 'token-a', consentUser());
  assert.equal(matchesOpinionSaveSession(started, 'token-a', consentUser('owner-a', 'epoch-b')), false);
  assert.equal(matchesOpinionSaveSession(started, 'token-a', consentUser('owner-a', 'epoch-a', false)), false);
  assert.equal(matchesOpinionSaveSession(started, 'token-a', { id: 'owner-a' }), false);
});

test('unverified and empty-epoch sessions cannot start a political POST', () => {
  assert.equal(captureOpinionSaveSession('owner-a', 'epoch-a', 'token-a', null), null);
  assert.equal(captureOpinionSaveSession('owner-a', null, 'token-a', consentUser()), null);
  assert.equal(captureOpinionSaveSession('owner-a', '  ', 'token-a', consentUser()), null);
  assert.equal(captureOpinionSaveSession('owner-a', 'epoch-a', '', consentUser()), null);
  assert.equal(captureOpinionSaveSession('owner-a', 'epoch-a', 'token-a', consentUser('owner-b')), null);
  assert.equal(captureOpinionSaveSession('owner-a', 'epoch-a', 'token-a', consentUser('owner-a','epoch-b')), null);
});
