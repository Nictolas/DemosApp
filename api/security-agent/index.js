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
const {
  ALERT_POLICY_VERSION: SECURITY_ALERT_POLICY_VERSION,
  PRIORITY_ORDER: SECURITY_ALERT_PRIORITY_ORDER,
  buildSecurityAlerts
} = require('./securityAlertPolicy');
const {
  ROUTING_POLICY_VERSION: SECURITY_ALERT_ROUTING_VERSION,
  ROUTES: SECURITY_ALERT_ROUTES,
  alertFingerprint,
  buildAlertRoutingPlan,
  acknowledgeAlert
} = require('./securityAlertRouting');
const {
  NOTIFICATION_CONTRACT_VERSION: SECURITY_NOTIFICATION_CONTRACT_VERSION,
  EXTERNAL_CHANNELS: SECURITY_NOTIFICATION_EXTERNAL_CHANNELS,
  INTERNAL_CHANNELS: SECURITY_NOTIFICATION_INTERNAL_CHANNELS,
  sanitizeNotificationTask,
  sanitizeAuditRecord: sanitizeNotificationAuditRecord,
  MemoryNotificationAudit,
  createNoopNotificationAdapter,
  buildDefaultNoopAdapters,
  NotificationDispatcher
} = require('./securityNotificationAdapters');
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
  SECURITY_ALERT_POLICY_VERSION,
  SECURITY_ALERT_PRIORITY_ORDER,
  buildSecurityAlerts,
  SECURITY_ALERT_ROUTING_VERSION,
  SECURITY_ALERT_ROUTES,
  alertFingerprint,
  buildAlertRoutingPlan,
  acknowledgeAlert,
  SECURITY_NOTIFICATION_CONTRACT_VERSION,
  SECURITY_NOTIFICATION_EXTERNAL_CHANNELS,
  SECURITY_NOTIFICATION_INTERNAL_CHANNELS,
  sanitizeNotificationTask,
  sanitizeNotificationAuditRecord,
  MemoryNotificationAudit,
  createNoopNotificationAdapter,
  buildDefaultNoopAdapters,
  NotificationDispatcher,
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
