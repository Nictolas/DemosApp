const test = require('node:test');
const assert = require('node:assert/strict');
const {
  buildAiLiveQualityRunnerConfig,
  runLiveAiProviderQuality
} = require('../security-agent/securityAiLiveQualityRunner');

const TEST_GROQ_KEY = ['gsk', 'ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890'].join('_');

function liveEnv(overrides = {}) {
  return {
    SECURITY_AI_PROVIDER_QUALITY_LIVE_ENABLED: 'true',
    SECURITY_AI_PROVIDER_QUALITY_MIN_PASS_RATE: '0.8',
    SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'true',
    SECURITY_AGENT_ENVIRONMENT_CLASS: 'staging',
    SECURITY_AGENT_STAGING_ID: 'demos-security-staging',
    SECURITY_AGENT_RUNTIME_MODE: 'memory',
    SECURITY_AGENT_PROCESS_ENABLED: 'false',
    SECURITY_AGENT_SHADOW_ENABLED: 'false',
    SECURITY_AGENT_RUNNER_ENABLED: 'false',
    SECURITY_AGENT_STORE_ENABLED: 'false',
    SECURITY_RETENTION_JOB_ENABLED: 'false',
    SECURITY_AGENT_ACTION_RUNNER_ENABLED: 'false',
    SECURITY_AI_SHADOW_INTEGRATION_ENABLED: 'true',
    SECURITY_AI_SHADOW_BACKEND: 'gateway',
    SECURITY_AI_MODEL_GATEWAY_ENABLED: 'true',
    SECURITY_AI_PROVIDER_POLICY_APPROVED: 'true',
    SECURITY_AI_PROVIDER: 'groq',
    SECURITY_AI_REGION: 'global',
    SECURITY_AI_MODEL: 'llama-3.3-70b-versatile',
    SECURITY_AI_PROVIDER_ALLOWLIST: 'groq',
    SECURITY_AI_REGION_ALLOWLIST: 'global',
    SECURITY_AI_MODEL_ALLOWLIST: 'llama-3.3-70b-versatile',
    SECURITY_AI_TIMEOUT_MS: '8000',
    SECURITY_AI_MAX_REQUEST_COST_MICROS: '100',
    SECURITY_AI_DAILY_COST_BUDGET_MICROS: '2000',
    SECURITY_AI_MAX_DAILY_REQUESTS: '20',
    SECURITY_AI_GROQ_REQUEST_COST_ESTIMATE_MICROS: '100',
    GROQ_API_KEY: TEST_GROQ_KEY,
    ...overrides
  };
}

function providerOutput(input = {}) {
  const incident = input.evidence?.incidents?.[0];
  if (!incident) {
    return {
      assessment: 'benign', confidence: 93, prioritySuggestion: 'P3',
      summary: 'No active security incident in synthetic baseline.', hypotheses: [],
      recommendedActions: ['observe'], requiresHumanReview: false
    };
  }
  if (incident.severity === 'critical') {
    return {
      assessment: 'likely_attack', confidence: 96, prioritySuggestion: 'P0',
      summary: 'Critical synthetic security incident requires review.',
      hypotheses: [{ code: 'critical_signal', confidence: 94 }],
      recommendedActions: ['investigate', 'escalate_human'], requiresHumanReview: true
    };
  }
  if (incident.ruleId === 'DET-TELEMETRY-GAP') {
    return {
      assessment: 'uncertain', confidence: 78, prioritySuggestion: 'P2',
      summary: 'Synthetic telemetry gap requires investigation.',
      hypotheses: [{ code: 'telemetry_gap', confidence: 80 }],
      recommendedActions: ['investigate'], requiresHumanReview: true
    };
  }
  return {
    assessment: 'suspicious', confidence: 88, prioritySuggestion: 'P1',
    summary: 'Synthetic high-risk signal requires investigation.',
    hypotheses: [{ code: 'high_risk_signal', confidence: 86 }],
    recommendedActions: ['investigate'], requiresHumanReview: true
  };
}

function fakeGroqClient({ mutate } = {}) {
  const calls = [];
  return {
    calls,
    chat: {
      completions: {
        async create(request) {
          calls.push(request);
          const user = request.messages.find(item => item.role === 'user');
          const input = JSON.parse(user.content);
          let result = providerOutput(input);
          if (typeof mutate === 'function') result = mutate(result, input);
          return { choices: [{ message: { content: JSON.stringify(result) } }] };
        }
      }
    }
  };
}

test('live quality runner is disabled by default and never requires a provider client', async () => {
  const config = buildAiLiveQualityRunnerConfig({});
  assert.equal(config.enabled, false);
  assert.equal(config.ready, false);
  const result = await runLiveAiProviderQuality({ env: {} });
  assert.equal(result.status, 'disabled');
  assert.equal(result.executable, false);
  assert.deepEqual(result.toolCalls, []);
});

test('live enablement without explicit staging isolation is blocked before transport', async () => {
  const env = liveEnv({ SECURITY_AGENT_STAGING_ISOLATION_REQUIRED: 'false' });
  const client = fakeGroqClient();
  const result = await runLiveAiProviderQuality({ env, client });
  assert.equal(result.status, 'blocked');
  assert.equal(client.calls.length, 0);
  assert.ok(result.blockers.includes('staging_isolation_not_required'));
});

test('production-like staging identity is blocked before transport', async () => {
  const env = liveEnv({ SECURITY_AGENT_STAGING_ID: 'demos-security-prod' });
  const client = fakeGroqClient();
  const result = await runLiveAiProviderQuality({ env, client });
  assert.equal(result.status, 'blocked');
  assert.equal(client.calls.length, 0);
  assert.ok(result.blockers.includes('staging_isolation_not_ready'));
});

test('isolated live runner can evaluate the full quality suite through an injected client', async () => {
  const client = fakeGroqClient();
  const result = await runLiveAiProviderQuality({ env: liveEnv(), client });
  assert.equal(result.status, 'accepted');
  assert.equal(result.accepted, true);
  assert.equal(result.caseCount, 6);
  assert.equal(result.failedCount, 0);
  assert.equal(result.safetyFailureCount, 0);
  assert.equal(result.injectedClient, true);
  assert.equal(client.calls.length, 6);
  assert.ok(client.calls.every(call => !Object.prototype.hasOwnProperty.call(call, 'tools')));
  assert.ok(client.calls.every(call => call.temperature === 0));
});

test('quality rejection does not enable execution or mutate systems', async () => {
  const client = fakeGroqClient({
    mutate(result, input) {
      if (input.evidence?.incidents?.[0]?.severity === 'critical') {
        return { ...result, assessment: 'benign', prioritySuggestion: 'P3', recommendedActions: ['observe'], requiresHumanReview: false };
      }
      return result;
    }
  });
  const result = await runLiveAiProviderQuality({ env: liveEnv(), client });
  assert.equal(result.status, 'rejected');
  assert.equal(result.accepted, false);
  assert.equal(result.executable, false);
  assert.deepEqual(result.toolCalls, []);
  assert.ok(result.mandatoryFailed.includes('critical-sqli'));
});

test('public live result never exposes the provider credential', async () => {
  const result = await runLiveAiProviderQuality({ env: liveEnv(), client: fakeGroqClient() });
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes(TEST_GROQ_KEY), false);
  assert.equal(result.staging.actionRunnerAvailable, false);
  assert.equal(result.staging.databaseWriterAllowed, false);
});

test('invalid live pass rate blocks execution before provider transport', async () => {
  const client = fakeGroqClient();
  const result = await runLiveAiProviderQuality({
    env: liveEnv({ SECURITY_AI_PROVIDER_QUALITY_MIN_PASS_RATE: '0.1' }),
    client
  });
  assert.equal(result.status, 'blocked');
  assert.equal(client.calls.length, 0);
  assert.ok(result.blockers.includes('quality_pass_rate_invalid'));
});
