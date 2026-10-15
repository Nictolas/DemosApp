const { buildAiAnalystRequest, validateAiAnalystOutput } = require('./securityAiAnalystContract');

const AI_ANALYST_MOCK_RUNNER_VERSION = 'v0.16';
const PRIORITY_RANK = Object.freeze({ P0: 0, P1: 1, P2: 2, P3: 3 });

function highestPriority(alerts = []) {
  return alerts.map(item => item.priority).filter(item => Object.prototype.hasOwnProperty.call(PRIORITY_RANK, item)).sort((a, b) => PRIORITY_RANK[a] - PRIORITY_RANK[b])[0] || 'P3';
}

function highestSeverity(incidents = []) {
  const rank = { info: 0, low: 1, medium: 2, high: 3, critical: 4 };
  return incidents.map(item => item.severity).filter(item => Object.prototype.hasOwnProperty.call(rank, item)).sort((a, b) => rank[b] - rank[a])[0] || 'info';
}

function createDeterministicMockAiProvider() {
  return Object.freeze({
    name: 'deterministic_mock', simulated: true, toolAccess: false, networkAccess: false,
    async analyze(request = {}) {
      if (request.mode !== 'shadow' || request.input?.controls?.readOnly !== true) throw new Error('unsafe analyst request');
      if (!Array.isArray(request.tools) || request.tools.length !== 0) throw new Error('mock provider refuses tools');
      const incidents = request.input?.evidence?.incidents || [];
      const alerts = request.input?.evidence?.alerts || [];
      const health = request.input?.evidence?.health || {};
      const severity = highestSeverity(incidents);
      const priority = highestPriority(alerts);
      let prioritySuggestion = 'P3';
      if (severity === 'critical' || priority === 'P0') prioritySuggestion = 'P0';
      else if (severity === 'high' || priority === 'P1' || health.level === 'red') prioritySuggestion = 'P1';
      else if (severity === 'medium' || priority === 'P2' || health.level === 'orange') prioritySuggestion = 'P2';
      let assessment = 'benign'; let confidence = 90; let hypothesis = 'no_high_severity_signal'; let recommendedActions = ['observe'];
      if (prioritySuggestion === 'P0') { assessment = 'likely_attack'; confidence = 95; hypothesis = 'correlated_critical_signal'; recommendedActions = ['investigate', 'escalate_human']; }
      else if (prioritySuggestion === 'P1') { assessment = 'suspicious'; confidence = 88; hypothesis = 'correlated_high_risk_signal'; recommendedActions = ['investigate', 'escalate_human']; }
      else if (prioritySuggestion === 'P2') { assessment = 'uncertain'; confidence = 72; hypothesis = 'moderate_risk_signal'; recommendedActions = ['investigate']; }
      return {
        assessment, confidence, prioritySuggestion,
        summary: `Mock analysis of ${incidents.length} incidents and ${alerts.length} alerts; highest priority ${prioritySuggestion}.`,
        hypotheses: [{ code: hypothesis, confidence }], recommendedActions,
        requiresHumanReview: prioritySuggestion === 'P0' || prioritySuggestion === 'P1'
      };
    }
  });
}

function emptyAiAnalystMockStatus() {
  return Object.freeze({ version: AI_ANALYST_MOCK_RUNNER_VERSION, state: 'never', simulated: true, provider: 'deterministic_mock', runCount: 0, successCount: 0, failureCount: 0, lastRunAt: null, lastErrorCode: null, latestPriority: null, latestAssessment: null });
}

class SecurityAiAnalystMockRunner {
  constructor({ provider = createDeterministicMockAiProvider(), maxRecent = 50 } = {}) {
    if (!provider || typeof provider.analyze !== 'function') throw new TypeError('AI analyst provider contract is required');
    if (provider.simulated !== true || provider.toolAccess === true || provider.networkAccess === true) throw new Error('AI analyst mock provider must be simulated and isolated');
    this.provider = provider;
    this.maxRecent = Number.isInteger(maxRecent) && maxRecent > 0 && maxRecent <= 200 ? maxRecent : 50;
    this.recent = []; this.runCount = 0; this.successCount = 0; this.failureCount = 0; this.lastRunAt = null; this.lastErrorCode = null;
  }

  async analyze(input = {}) {
    this.runCount += 1; this.lastRunAt = new Date().toISOString();
    try {
      const request = buildAiAnalystRequest(input);
      const raw = await this.provider.analyze(request);
      const validated = validateAiAnalystOutput(raw);
      const record = Object.freeze({
        analyzedAt: this.lastRunAt, assessment: validated.assessment, confidence: validated.confidence,
        prioritySuggestion: validated.prioritySuggestion, summary: validated.summary, hypotheses: validated.hypotheses,
        recommendedActions: validated.recommendedActions, requiresHumanReview: validated.requiresHumanReview,
        executable: false, toolCalls: Object.freeze([])
      });
      this.successCount += 1; this.lastErrorCode = null; this.recent.push(record);
      if (this.recent.length > this.maxRecent) this.recent.splice(0, this.recent.length - this.maxRecent);
      return record;
    } catch (_error) {
      this.failureCount += 1; this.lastErrorCode = 'AI_ANALYST_MOCK_VALIDATION_FAILED';
      throw new Error(this.lastErrorCode);
    }
  }

  status() {
    const latest = this.recent[this.recent.length - 1] || null;
    return Object.freeze({
      version: AI_ANALYST_MOCK_RUNNER_VERSION, state: this.runCount === 0 ? 'never' : (this.lastErrorCode ? 'error' : 'ok'),
      simulated: true, provider: String(this.provider.name || 'mock').slice(0, 48), runCount: this.runCount,
      successCount: this.successCount, failureCount: this.failureCount, lastRunAt: this.lastRunAt,
      lastErrorCode: this.lastErrorCode, latestPriority: latest?.prioritySuggestion || null, latestAssessment: latest?.assessment || null
    });
  }

  listRecent({ limit = 20 } = {}) {
    const parsed = Number(limit);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 100) throw new Error('invalid AI analyst recent limit');
    return Object.freeze(this.recent.slice(-parsed).reverse().map(item => Object.freeze({ ...item })));
  }
}

module.exports = { AI_ANALYST_MOCK_RUNNER_VERSION, createDeterministicMockAiProvider, emptyAiAnalystMockStatus, SecurityAiAnalystMockRunner };
