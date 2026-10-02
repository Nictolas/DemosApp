const {
  sanitizeResearchTelemetry
} = require('./researchTelemetryPolicy');

const createResearchTelemetryAdapter = ({ sink }) => {
  if (typeof sink !== 'function') {
    throw new Error('Research telemetry sink is required');
  }

  return {
    emit(event) {
      const sanitized = sanitizeResearchTelemetry(event);
      if (Object.keys(sanitized).length === 0) {
        return false;
      }
      sink(sanitized);
      return true;
    }
  };
};

module.exports = {
  createResearchTelemetryAdapter
};
