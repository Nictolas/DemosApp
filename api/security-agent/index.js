const { SecurityCollector } = require('./securityCollector');
const { DetectionEngine } = require('./detectionEngine');
const { IncidentManager } = require('./incidentManager');
const { ShadowSecurityPipeline } = require('./shadowPipeline');
const { ReadOnlySecuritySource, createAxiomReadOnlySecuritySource } = require('./readOnlySecuritySource');
const { MemorySecurityStore, sanitizeIncidentForStore, sanitizeSourceState } = require('./securityStore');
const { PostgresSecurityStore } = require('./postgresSecurityStore');
const {
  PURPOSES: SECURITY_DATABASE_PURPOSES,
  buildSecurityDbClientConfig,
  createPoolForPurpose,
  publicCredentialStatus,
  parseRetentionDays
} = require('./securityDbCredentialGate');
const { ShadowSecurityRunner, createShadowSecurityRunner } = require('./shadowRunner');
const { SecurityCenterService } = require('./securityCenterService');
const { createSecurityCenterHandlers } = require('./securityCenterApi');
const { createSecurityCenterRouter } = require('./securityCenterRouter');
const { buildSecurityCenterOverview, pickIncident } = require('./securityCenterReadModel');
const { normalizeSecurityEvent, sanitizeMeta } = require('./securityEvent');
const { adaptLegacySecurityRecord, adaptLegacyViolation } = require('./legacyAdapters');

module.exports = {
  SecurityCollector,
  DetectionEngine,
  IncidentManager,
  ShadowSecurityPipeline,
  ReadOnlySecuritySource,
  createAxiomReadOnlySecuritySource,
  MemorySecurityStore,
  PostgresSecurityStore,
  SECURITY_DATABASE_PURPOSES,
  buildSecurityDbClientConfig,
  createPoolForPurpose,
  publicCredentialStatus,
  parseRetentionDays,
  sanitizeIncidentForStore,
  sanitizeSourceState,
  ShadowSecurityRunner,
  createShadowSecurityRunner,
  SecurityCenterService,
  createSecurityCenterHandlers,
  createSecurityCenterRouter,
  buildSecurityCenterOverview,
  pickIncident,
  normalizeSecurityEvent,
  sanitizeMeta,
  adaptLegacySecurityRecord,
  adaptLegacyViolation
};
