const { RESEARCH_FAILURE_KIND } = require('./researchFailureClassification');

const ALLOWED_KINDS = new Set(Object.values(RESEARCH_FAILURE_KIND));

const DEFAULT_EVENT_BUDGET = 100;
const MAX_EVENT_BUDGET = 1000;
const DIAGNOSTICS_ENABLE_TOKEN = Symbol('research-diagnostics-enable');

const normalizeEventBudget = (value) => {
  if (value === undefined) return DEFAULT_EVENT_BUDGET;
  if (!Number.isSafeInteger(value) || value < 1 || value > MAX_EVENT_BUDGET) return 0;
  return value;
};

const createResearchFailureDiagnostics = ({ enableToken = null, sink = null, eventBudget } = {}) => {
  const budget = normalizeEventBudget(eventBudget);
  const active = enableToken === DIAGNOSTICS_ENABLE_TOKEN && typeof sink === 'function' && budget > 0;
  let emitted = 0;

  const record = (classification) => {
    if (!active || emitted >= budget) return false;
    const kind = classification?.kind;
    if (!ALLOWED_KINDS.has(kind)) return false;
    try {
      emitted += 1;
      const result = sink(Object.freeze({ kind, count: 1 }));
      if (result && typeof result.then === 'function') {
        Promise.resolve(result).catch(() => {});
      }
      return true;
    } catch {
      return false;
    }
  };

  return Object.freeze({ enabled: active, record });
};

module.exports = {
  createResearchFailureDiagnostics,
  DIAGNOSTICS_ENABLE_TOKEN
};
