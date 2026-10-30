import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import vm from 'node:vm';

// Execute the actual production hook body with only React Query, auth and
// HTTP mocked. No user records, login tokens or Supabase are involved.
const source = readFileSync(
  new URL('../src/hooks/usePoliticalOpinionsConsent.ts', import.meta.url), 'utf8'
);
const executable = stripTypeScriptTypes(source)
  .replace(/^import\s+[\s\S]*?\s+from\s+['"][^'"]+['"];?/gm, '')
  .replace(/^export\s+/gm, '');

const verified = (granted = true, timestamp = 'synthetic-epoch-1') => ({
  user: { id: 'synthetic-owner' },
  isLoading: false,
  isSessionVerified: true,
  verifiedPoliticalConsent: { granted, timestamp },
});

function fixture(auth, cachedResponse) {
  let personalReads = 0;
  let queryOptions;
  const sandbox = {
    useAuth: () => auth,
    useQuery: options => {
      queryOptions = options;
      return {
        data: cachedResponse ?? options.initialData,
        isLoading: false,
        error: null,
        refetch: async () => options.queryFn(),
      };
    },
    apiRequest: async (method, path) => {
      personalReads += 1;
      assert.equal(method, 'GET');
      assert.equal(path, '/api/user/political-opinions-consent');
      return {
        ok: true,
        data: { success: true, consent: {
          granted: true, timestamp: 'synthetic-epoch-2',
          ipAddress: null, userAgent: null,
        } },
      };
    },
  };
  vm.runInNewContext(executable + '\nthis.consentHook = usePoliticalOpinionsConsent;',
    sandbox, { filename: 'usePoliticalOpinionsConsent.ts' });
  const value = sandbox.consentHook();
  return {
    value,
    options: queryOptions,
    getReads: () => personalReads,
  };
}

test('verified consent primes the existing React Query without a second SQL GET', () => {
  const h = fixture(verified());
  assert.equal(h.value.hasConsent, true);
  assert.equal(h.value.consent.timestamp, 'synthetic-epoch-1');
  assert.equal(h.options.initialData.consent.granted, true);
  assert.equal(h.options.staleTime, Infinity);
  assert.equal(h.options.enabled, true);
  assert.equal(h.options.queryKey[0], 'political-opinions-consent');
  assert.equal(h.options.queryKey[1], 'synthetic-owner');
  assert.equal(h.getReads(), 0, 'Opening an editor needs no consent-specific GET');
});

test('verified revocation overrides a stale dedicated query granting consent', () => {
  const stale = { success: true, consent: {
    granted: true, timestamp: 'old-consent',
  } };
  const h = fixture(verified(false, null), stale);
  assert.equal(h.value.hasConsent, false);
  assert.equal(h.value.consent.granted, false);
  assert.equal(h.getReads(), 0);
});

test('a JWT-decoded user cannot authorize personal answers without auth/me', () => {
  const h = fixture({
    user: { id: 'synthetic-owner' },
    isSessionVerified: false,
    isLoading: false,
    verifiedPoliticalConsent: null,
  }, { success: true, consent: { granted: true, timestamp: 'old' } });
  assert.equal(h.options.enabled, false);
  assert.equal(h.options.initialData, undefined);
  assert.equal(h.value.hasConsent, false);
  assert.equal(h.value.consent, null);
  assert.equal(h.getReads(), 0);
});

test('granted flag without a verified consent epoch cannot enable saving', () => {
  for (const epoch of ['', '  ', null]) {
    const h = fixture(verified(true, epoch));
    assert.equal(h.value.hasConsent, false);
    assert.equal(h.getReads(), 0);
  }
});

test('explicit consent refresh after mutation retains the dedicated server endpoint', async () => {
  const h = fixture(verified());
  const result = await h.value.refetch();
  assert.equal(h.getReads(), 1, 'Only an explicit refetch contacts the consent endpoint');
  assert.equal(result.consent.timestamp, 'synthetic-epoch-2');
});

test('an unauthorized explicit refetch is blocked before reaching the network', async () => {
  const h = fixture({
    user: { id: 'synthetic-owner' },
    isSessionVerified: false,
    isLoading: false,
    verifiedPoliticalConsent: null,
  });
  await assert.rejects(h.value.refetch(), /Sessione non verificata/);
  assert.equal(h.getReads(), 0);
});

test('current verified auth epoch wins even when the React Query entry is older', () => {
  const h = fixture(verified(true, 'new-epoch'), {
    success: true,
    consent: { granted: false, timestamp: null },
  });
  assert.equal(h.value.hasConsent, true);
  assert.equal(h.value.consent.timestamp, 'new-epoch');
});
