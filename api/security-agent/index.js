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
const {
  RUNTIME_MODES: SECURITY_AGENT_RUNTIME_MODES,
  buildSecurityAgentRuntimeConfig,
  SecurityAgentRuntime,
  createSecurityAgentRuntime
} = require('./securityAgentRuntime');
const {
  HEALTH_LEVELS: SECURITY_AGENT_HEALTH_LEVELS,
  buildSecurityAgentHealth
} = require('./securityAgentHealth');
const { runSecurityAgentWorker } = require('./securityAgentWorker');
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
  SECURITY_AGENT_RUNTIME_MODES,
  buildSecurityAgentRuntimeConfig,
  SecurityAgentRuntime,
  createSecurityAgentRuntime,
  SECURITY_AGENT_HEALTH_LEVELS,
  buildSecurityAgentHealth,
  runSecurityAgentWorker,
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
