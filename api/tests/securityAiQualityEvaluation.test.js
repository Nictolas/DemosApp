const test = require('node:test');
const assert = require('node:assert/strict');
const {
  QUALITY_CASES,
  evaluateAiProviderQuality
} = require('../security-agent/securityAiQualityEvaluation');

function output(overrides = {}) {
  return {
    assessment: 'suspicious',
    confidence: 88,
    prioritySuggestion: 'P1',
    summary: 'Synthetic security assessment.',
    hypotheses: [{ code: 'synthetic_signal', confidence: 80 }],
    recommendedActions: ['investigate'],
    requiresHumanReview: true,
    executable: false,
    toolCalls: [],
    ...overrides
  };
}

function passingAnalyzer(input = {}) {
  const incident = input.incidents?.[0];
  if (!incident) {
    return output({
      assessment: 'benign',
      confidence: 92,
      prioritySuggestion: 'P3',
      recommendedActions: ['observe'],
      requiresHumanReview: false
    });
  }
  if (incident.severity === 'critical') {
    return output({
      assessment: 'likely_attack',
      confidence: 96,
      prioritySuggestion: 'P0',
      recommendedActions: ['investigate', 'escalate_human'],
      requiresHumanReview: true
    });
  }
  if (incident.ruleId === 'DET-TELEMETRY-GAP') {
    return output({
      assessment: 'uncertain',
      confidence: 78,
      prioritySuggestion: 'P2',
      recommendedActions: ['investigate'],
      requiresHumanReview: true
    });
  }
  return output({
    assessment: 'suspicious',
    confidence: 87,
    prioritySuggestion: 'P1',
    recommendedActions: ['investigate'],
    requiresHumanReview: true
  });
}

test('quality case library is bounded, unique and contains mandatory high-risk plus benign controls', () => {
  assert.ok(QUALITY_CASES.length >= 5 && QUALITY_CASES.length <= 20);
  assert.equal(new Set(QUALITY_CASES.map(item => item.id)).size, QUALITY_CASES.length);
  assert.ok(QUALITY_CASES.some(item => item.id === 'critical-sqli' && item.mandatory));
  assert.ok(QUALITY_CASES.some(item => item.id === 'critical-admin-compromise' && item.mandatory));
  assert.ok(QUALITY_CASES.some(item => item.id === 'benign-baseline' && item.mandatory));
});

test('passing provider clears every quality case without enabling execution or tools', async () => {
  const result = await evaluateAiProviderQuality({ analyze: async input => passingAnalyzer(input) });
  assert.equal(result.accepted, true);
  assert.equal(result.failedCount, 0);
  assert.equal(result.safetyFailureCount, 0);
  assert.equal(result.executable, false);
  assert.deepEqual(result.toolCalls, []);
});

test('critical under-triage fails a mandatory case even when output is contract-valid', async () => {
  const result = await evaluateAiProviderQuality({
    analyze: async input => input.incidents?.[0]?.severity === 'critical'
      ? output({ assessment: 'benign', prioritySuggestion: 'P3', recommendedActions: ['observe'], requiresHumanReview: false })
      : passingAnalyzer(input)
  });
  assert.equal(result.accepted, false);
  assert.ok(result.mandatoryFailed.includes('critical-sqli'));
  assert.ok(result.results.find(item => item.caseId === 'critical-sqli').reasons.includes('priority_undertriage'));
});

test('benign baseline rejects over-triage and mitigation proposals', async () => {
  const result = await evaluateAiProviderQuality({
    analyze: async input => input.incidents?.length
      ? passingAnalyzer(input)
      : output({ assessment: 'suspicious', prioritySuggestion: 'P0', recommendedActions: ['propose_session_revocation'], requiresHumanReview: true })
  });
  const baseline = result.results.find(item => item.caseId === 'benign-baseline');
  assert.equal(baseline.passed, false);
  assert.ok(baseline.reasons.includes('priority_overtriage'));
  assert.ok(baseline.reasons.includes('forbidden_action_proposed'));
  assert.equal(result.accepted, false);
});

test('executable or tool-bearing provider output is a safety failure', async () => {
  const executable = await evaluateAiProviderQuality({
    analyze: async input => ({ ...passingAnalyzer(input), executable: true })
  });
  assert.equal(executable.accepted, false);
  assert.equal(executable.safetyFailureCount, QUALITY_CASES.length);

  const tools = await evaluateAiProviderQuality({
    analyze: async input => ({ ...passingAnalyzer(input), toolCalls: [{ name: 'write_database' }] })
  });
  assert.equal(tools.accepted, false);
  assert.equal(tools.safetyFailureCount, QUALITY_CASES.length);
});

test('provider exceptions are collapsed to safe case failures without leaking provider details', async () => {
  const secret = ['provider', 'secret', 'detail'].join('-');
  const result = await evaluateAiProviderQuality({
    analyze: async () => { throw new Error(secret); }
  });
  assert.equal(result.accepted, false);
  assert.equal(result.safetyFailureCount, QUALITY_CASES.length);
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.ok(result.results.every(item => item.reasons[0] === 'contract_or_provider_failure'));
});

test('invalid pass-rate and duplicate cases fail closed', async () => {
  await assert.rejects(
    () => evaluateAiProviderQuality({ analyze: async input => passingAnalyzer(input), minPassRate: 0.1 }),
    /AI_QUALITY_PASS_RATE_INVALID/
  );
  await assert.rejects(
    () => evaluateAiProviderQuality({ analyze: async input => passingAnalyzer(input), cases: [QUALITY_CASES[0], QUALITY_CASES[0]] }),
    /AI_QUALITY_CASE_DUPLICATE/
  );
});
