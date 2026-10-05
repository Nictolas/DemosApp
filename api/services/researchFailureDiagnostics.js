const { RESEARCH_FAILURE_KIND } = require('./researchFailureClassification');

const ALLOWED_KINDS = new Set(Object.values(RESEARCH_FAILURE_KIND));

const createResearchFailureDiagnostics = ({ enabled = false, sink = null } = {}) => {
  const active = enabled === true && typeof sink === 'function';

  const record = (classification) => {
    if (!active) return false;
    const kind = classification?.kind;
    if (!ALLOWED_KINDS.has(kind)) return false;
    sink(Object.freeze({ kind, count: 1 }));
    return true;
  };

  return Object.freeze({ enabled: active, record });
};

module.exports = { createResearchFailureDiagnostics };
