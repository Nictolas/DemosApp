const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildSecurityAxiomReadOnlyConfig,
  SecurityAxiomReadOnlyProvider,
  createSecurityAxiomReadOnlyProvider
} = require('../security-agent/securityAxiomReadOnlyProvider');

function env(overrides = {}) {
  return {
    SECURITY_AGENT_AXIOM_ENABLED: 'true',
    SECURITY_AGENT_AXIOM_QUERY_ONLY: 'true',
    SECURITY_AGENT_ENVIRONMENT_CLASS: 'staging',
    SECURITY_AGENT_AXIOM_REGION: 'eu',
    SECURITY_AGENT_AXIOM_DATASET: 'demos-security-staging',
    SECURITY_AGENT_AXIOM_API_TOKEN: 'xaat-' + 'A'.repeat(40),
    SECURITY_AGENT_AXIOM_ORG_ID: 'demos-staging-org',
    SECURITY_AGENT_AXIOM_TIMEOUT_MS: '5000',
    ...overrides
  };
}

function fakeClient(result = { matches: [] }) {
  const calls = [];
  return {
    calls,
    async query(query, options) {
      calls.push({ query, options });
      return result;
    }
  };
}

test('dedicated Axiom provider is disabled by default and never inherits generic app credentials', () => {
  const config = buildSecurityAxiomReadOnlyConfig({
    AXIOM_ENABLED: 'true',
    AXIOM_API_TOKEN: 'legacy-production-token',
    AXIOM_ORG_ID: 'legacy-org',
    AXIOM_REALTIME_DATASET: 'real-time'
  });
  assert.equal(config.enabled, false);
  assert.equal(config.ready, false);
  assert.equal(config.tokenPresent, false);
  assert.equal(config.orgIdPresent, false);
  assert.equal(config.dataset, null);
});

test('ready config requires staging, EU, isolated dataset and explicit query-only declaration', () => {
  const ready = buildSecurityAxiomReadOnlyConfig(env());
  assert.equal(ready.ready, true);
  assert.equal(ready.queryOnly, true);
  assert.equal(ready.region, 'eu');
  assert.equal(ready.isolatedDataset, true);
  assert.equal(ready.writeAccess, false);
  assert.equal(ready.executable, false);

  const unsafe = buildSecurityAxiomReadOnlyConfig(env({
    SECURITY_AGENT_AXIOM_QUERY_ONLY: 'false',
    SECURITY_AGENT_AXIOM_REGION: 'us',
    SECURITY_AGENT_AXIOM_DATASET: 'demos-security-prod'
  }));
  assert.equal(unsafe.ready, false);
  assert.ok(unsafe.blockers.includes('query_only_not_declared'));
  assert.ok(unsafe.blockers.includes('region_not_eu'));
  assert.ok(unsafe.blockers.includes('dataset_not_isolated'));
});

test('read-only provider performs only a bounded query against the dedicated dataset', async () => {
  const client = fakeClient({ matches: [
    { _time:'2026-10-06T18:00:00.000Z', data:{ type:'failed_login', severity:'medium', user_id:'raw-id' } },
    { _time:'2026-10-06T18:00:01.000Z', type:'suspicious_request', severity:'high' },
    { _time:'2026-10-06T18:00:02.000Z', action:'DATA_ACCESS', resource:'users' }
  ] });
  const provider = createSecurityAxiomReadOnlyProvider({ env: env(), client });
  const rows = await provider.getSecurityEvents({
    startTime: new Date('2026-10-06T17:55:00.000Z'),
    endTime: new Date('2026-10-06T18:05:00.000Z'),
    limit: 10
  });
  assert.equal(rows.length, 2);
  assert.equal(rows[0]._time, '2026-10-06T18:00:00.000Z');
  assert.equal(client.calls.length, 1);
  assert.match(client.calls[0].query, /^\['demos-security-staging'\] \| order by _time asc \| limit 20$/);
  assert.equal(client.calls[0].options.timeout, 5000);
  assert.equal(provider.queryOnly, true);
  assert.equal(provider.writeAccess, false);
  assert.equal(provider.executable, false);
  assert.equal(typeof provider.ingest, 'undefined');
});

test('provider failures collapse to a generic code and public status never exposes credentials', async () => {
  const secret = 'xaat-' + 'S'.repeat(40);
  const client = { async query() { throw new Error(`provider leaked ${secret}`); } };
  const provider = new SecurityAxiomReadOnlyProvider({
    config: buildSecurityAxiomReadOnlyConfig(env({ SECURITY_AGENT_AXIOM_API_TOKEN: secret })),
    client
  });
  await assert.rejects(
    () => provider.getSecurityEvents({ startTime:new Date('2026-10-06T18:00:00Z'), endTime:new Date('2026-10-06T18:01:00Z') }),
    /^Error: SECURITY_AXIOM_QUERY_FAILED$/
  );
  const status = JSON.stringify(provider.status());
  assert.equal(status.includes(secret), false);
  assert.equal(status.includes('demos-staging-org'), false);
});
