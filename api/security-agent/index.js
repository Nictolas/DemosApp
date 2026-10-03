const { SecurityCollector } = require('./securityCollector');
const { DetectionEngine } = require('./detectionEngine');
const { IncidentManager } = require('./incidentManager');
const { ShadowSecurityPipeline } = require('./shadowPipeline');
const { normalizeSecurityEvent, sanitizeMeta } = require('./securityEvent');
const { adaptLegacySecurityRecord, adaptLegacyViolation } = require('./legacyAdapters');

module.exports = {
  SecurityCollector,
  DetectionEngine,
  IncidentManager,
  ShadowSecurityPipeline,
  normalizeSecurityEvent,
  sanitizeMeta,
  adaptLegacySecurityRecord,
  adaptLegacyViolation
};
