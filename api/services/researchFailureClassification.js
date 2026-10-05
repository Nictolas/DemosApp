const RESEARCH_FAILURE_KIND = Object.freeze({
  REQUEST: 'request',
  POLICY: 'policy',
  INFRASTRUCTURE: 'infrastructure'
});

const makeResearchFailure = (kind) => Object.freeze({ kind });

const classifyResearchFailure = (error) => {
  if (error?.message === 'Research database unavailable') {
    return makeResearchFailure(RESEARCH_FAILURE_KIND.INFRASTRUCTURE);
  }
  if (typeof error?.message === 'string' && /policy|threshold|proof|challenge/i.test(error.message)) {
    return makeResearchFailure(RESEARCH_FAILURE_KIND.POLICY);
  }
  return makeResearchFailure(RESEARCH_FAILURE_KIND.REQUEST);
};

module.exports = {
  RESEARCH_FAILURE_KIND,
  classifyResearchFailure
};
