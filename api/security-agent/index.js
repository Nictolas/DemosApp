const { SecurityCollector } = require('./securityCollector');
const { DetectionEngine } = require('./detectionEngine');
const { IncidentManager } = require('./incidentManager');
const { normalizeSecurityEvent, sanitizeMeta } = require('./securityEvent');

module.exports = {
  SecurityCollector,
  DetectionEngine,
  IncidentManager,
  normalizeSecurityEvent,
  sanitizeMeta
};
