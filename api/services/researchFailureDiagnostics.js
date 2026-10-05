const { RESEARCH_FAILURE_KIND } = require('./researchFailureClassification');

const ALLOWED_KINDS = new Set(Object.values(RESEARCH_FAILURE_KIND));

const createResearchFailureDiagnostics = ({ enabled = false, sink = null } = {}) => {
  const active = enabled === true && typeof sink === 'function';

  const record = (classification) => {
    if (!active) return false;
    const kind = classification?.kind;
    if (!ALLOWED_KINDS.has(kind)) return false;
    try {
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

module.exports = { createResearchFailureDiagnostics };
