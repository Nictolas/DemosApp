const RESEARCH_FAILURE_KIND = Object.freeze({
  REQUEST: 'request',
  POLICY: 'policy',
  INFRASTRUCTURE: 'infrastructure'
});

const makeResearchFailure = (kind) => Object.freeze({ kind });

const readErrorMessage = (error) => {
  try {
    const message = error?.message;
    return typeof message === 'string' ? message : null;
  } catch {
    return null;
  }
};

const classifyResearchFailure = (error) => {
  const message = readErrorMessage(error);
  if (message === 'Research database unavailable') {
    return makeResearchFailure(RESEARCH_FAILURE_KIND.INFRASTRUCTURE);
  }
  if (message && /policy|threshold|proof|challenge/i.test(message)) {
    return makeResearchFailure(RESEARCH_FAILURE_KIND.POLICY);
  }
  return makeResearchFailure(RESEARCH_FAILURE_KIND.REQUEST);
};

module.exports = {
  RESEARCH_FAILURE_KIND,
  classifyResearchFailure
};
