const { SecurityCollector } = require('./securityCollector');
const { DetectionEngine } = require('./detectionEngine');
const { IncidentManager } = require('./incidentManager');
const { ShadowSecurityPipeline } = require('./shadowPipeline');
const { ReadOnlySecuritySource, createAxiomReadOnlySecuritySource } = require('./readOnlySecuritySource');
const { MemorySecurityStore, sanitizeIncidentForStore, sanitizeSourceState } = require('./securityStore');
const { PostgresSecurityStore } = require('./postgresSecurityStore');
const { PURPOSES: SECURITY_DATABASE_PURPOSES, buildSecurityDbClientConfig, createPoolForPurpose, publicCredentialStatus, parseRetentionDays } = require('./securityDbCredentialGate');
const { RUNTIME_MODES: SECURITY_AGENT_RUNTIME_MODES, buildSecurityAgentRuntimeConfig, SecurityAgentRuntime, createSecurityAgentRuntime } = require('./securityAgentRuntime');
const { STAGING_ISOLATION_VERSION: SECURITY_STAGING_ISOLATION_VERSION, buildSecurityStagingIsolationConfig, assertSecurityStagingIsolation } = require('./securityStagingIsolation');
const { ACTION_CATALOG_VERSION: SECURITY_ACTION_CATALOG_VERSION, ACTION_CATALOG: SECURITY_ACTION_CATALOG, RECOMMENDED_ACTIONS: SECURITY_ACTION_CATALOG_ACTIONS, APPROVAL_ACTIONS: SECURITY_APPROVAL_ACTIONS, BOUNDARY_ACTIONS: SECURITY_BOUNDARY_ACTIONS, validateActionCatalog: validateSecurityActionCatalog, actionCatalogStatus: securityActionCatalogStatus } = require('./securityActionCatalog');
const { POLICY_AUDIT_EVIDENCE_VERSION: SECURITY_POLICY_AUDIT_EVIDENCE_VERSION, buildPolicyAuditEvidence: buildSecurityPolicyAuditEvidence } = require('./securityPolicyAuditEvidence');
const { HEALTH_LEVELS: SECURITY_AGENT_HEALTH_LEVELS, buildSecurityAgentHealth } = require('./securityAgentHealth');
const { ALERT_POLICY_VERSION: SECURITY_ALERT_POLICY_VERSION, PRIORITY_ORDER: SECURITY_ALERT_PRIORITY_ORDER, buildSecurityAlerts } = require('./securityAlertPolicy');
const { ROUTING_POLICY_VERSION: SECURITY_ALERT_ROUTING_VERSION, ROUTES: SECURITY_ALERT_ROUTES, alertFingerprint, buildAlertRoutingPlan, acknowledgeAlert } = require('./securityAlertRouting');
const { NOTIFICATION_CONTRACT_VERSION: SECURITY_NOTIFICATION_CONTRACT_VERSION, EXTERNAL_CHANNELS: SECURITY_NOTIFICATION_EXTERNAL_CHANNELS, INTERNAL_CHANNELS: SECURITY_NOTIFICATION_INTERNAL_CHANNELS, sanitizeNotificationTask, sanitizeAuditRecord: sanitizeNotificationAuditRecord, MemoryNotificationAudit, createNoopNotificationAdapter, buildDefaultNoopAdapters, NotificationDispatcher } = require('./securityNotificationAdapters');
const { NOTIFICATION_SIMULATION_VERSION: SECURITY_NOTIFICATION_SIMULATION_VERSION, validateAuditLimit: validateNotificationAuditLimit, emptyNotificationSimulationStatus, SecurityNotificationSimulation } = require('./securityNotificationSimulation');
const { AI_ANALYST_CONTRACT_VERSION: SECURITY_AI_ANALYST_CONTRACT_VERSION, AI_ANALYST_MODE: SECURITY_AI_ANALYST_MODE, AI_ANALYST_SYSTEM_POLICY: SECURITY_AI_ANALYST_SYSTEM_POLICY, ASSESSMENTS: SECURITY_AI_ANALYST_ASSESSMENTS, PRIORITIES: SECURITY_AI_ANALYST_PRIORITIES, RECOMMENDED_ACTIONS: SECURITY_AI_ANALYST_RECOMMENDED_ACTIONS, sanitizeIncidentForAi, sanitizeAlertForAi, sanitizeHealthForAi, buildAiAnalystInput, validateAiAnalystOutput, buildAiAnalystRequest } = require('./securityAiAnalystContract');
const { AI_ANALYST_MOCK_RUNNER_VERSION: SECURITY_AI_ANALYST_MOCK_RUNNER_VERSION, createDeterministicMockAiProvider, emptyAiAnalystMockStatus, SecurityAiAnalystMockRunner } = require('./securityAiAnalystMockRunner');
const { MODEL_GATEWAY_VERSION: SECURITY_AI_MODEL_GATEWAY_VERSION, DEFAULT_TIMEOUT_MS: SECURITY_AI_MODEL_GATEWAY_DEFAULT_TIMEOUT_MS, buildModelGatewayConfig, SecurityAiModelGateway } = require('./securityAiModelGateway');
const { SECURITY_AI_GROQ_PROVIDER_VERSION, buildGroqSecurityProviderConfig, SecurityAiGroqProvider, createGroqSecurityAiProvider } = require('./securityAiGroqProvider');
const { AI_PROVIDER_QUALITY_VERSION: SECURITY_AI_PROVIDER_QUALITY_VERSION, QUALITY_CASES: SECURITY_AI_PROVIDER_QUALITY_CASES, evaluateAiProviderQuality } = require('./securityAiQualityEvaluation');
const { AI_LIVE_QUALITY_RUNNER_VERSION: SECURITY_AI_LIVE_QUALITY_RUNNER_VERSION, buildAiLiveQualityRunnerConfig, runLiveAiProviderQuality } = require('./securityAiLiveQualityRunner');
const { AI_SHADOW_INTEGRATION_VERSION: SECURITY_AI_SHADOW_INTEGRATION_VERSION, ALLOWED_BACKENDS: SECURITY_AI_SHADOW_ALLOWED_BACKENDS, buildAiShadowIntegrationConfig, SecurityAiShadowIntegration, createSecurityAiShadowIntegration } = require('./securityAiShadowIntegration');
const { AI_ANALYSIS_ORCHESTRATOR_VERSION: SECURITY_AI_ANALYSIS_ORCHESTRATOR_VERSION, SEVERITY_RANK: SECURITY_AI_ANALYSIS_SEVERITY_RANK, buildAiAnalysisOrchestratorConfig, SecurityAiAnalysisOrchestrator, createSecurityAiAnalysisOrchestrator, publicCycleResult: publicAiAnalysisCycleResult } = require('./securityAiAnalysisOrchestrator');
const { APPROVAL_GATE_VERSION: SECURITY_APPROVAL_GATE_VERSION, APPROVAL_STATES: SECURITY_APPROVAL_STATES, SecurityApprovalGate } = require('./securityApprovalGate');
const { POLICY_ENGINE_VERSION: SECURITY_POLICY_ENGINE_VERSION, POLICY_DECISIONS: SECURITY_POLICY_DECISIONS, ACTION_POLICY: SECURITY_ACTION_POLICY, evaluateActionPolicy: evaluateSecurityActionPolicy, evaluateAiPolicy: evaluateSecurityAiPolicy, policyStatus: securityPolicyStatus } = require('./securityPolicyEngine');
const { PHASE4_DEPLOYED_VALIDATION_VERSION: SECURITY_PHASE4_DEPLOYED_VALIDATION_VERSION, VALIDATION_ROUTES: SECURITY_PHASE4_VALIDATION_ROUTES, buildPhase4DeployedValidationConfig, runPhase4DeployedValidation } = require('./securityPhase4DeployedValidation');
const { runSecurityAgentWorker } = require('./securityAgentWorker');
const { ShadowSecurityRunner, createShadowSecurityRunner, publicAiAnalysisResult } = require('./shadowRunner');
const { SecurityCenterService } = require('./securityCenterService');
const { createSecurityCenterHandlers } = require('./securityCenterApi');
const { createSecurityCenterRouter } = require('./securityCenterRouter');
const { SECURITY_CENTER_MOUNT_VERSION, SECURITY_CENTER_DEFAULT_PREFIX, buildSecurityCenterMountConfig, createReadOnlySecurityCenterService, mountSecurityCenterRuntime } = require('./securityCenterMount');
const { SECURITY_CENTER_STAGING_AUTH_VERSION, buildSecurityCenterStagingAuthConfig, createSecurityCenterStagingAuth } = require('./securityCenterStagingAuth');
const { buildSecurityCenterOverview, pickIncident } = require('./securityCenterReadModel');
const { normalizeSecurityEvent, sanitizeMeta } = require('./securityEvent');
const { adaptLegacySecurityRecord, adaptLegacyViolation } = require('./legacyAdapters');

module.exports = {
  SecurityCollector, DetectionEngine, IncidentManager, ShadowSecurityPipeline, ReadOnlySecuritySource, createAxiomReadOnlySecuritySource,
  MemorySecurityStore, PostgresSecurityStore, SECURITY_DATABASE_PURPOSES, buildSecurityDbClientConfig, createPoolForPurpose, publicCredentialStatus, parseRetentionDays,
  SECURITY_AGENT_RUNTIME_MODES, buildSecurityAgentRuntimeConfig, SecurityAgentRuntime, createSecurityAgentRuntime, SECURITY_STAGING_ISOLATION_VERSION, buildSecurityStagingIsolationConfig, assertSecurityStagingIsolation,
  SECURITY_ACTION_CATALOG_VERSION, SECURITY_ACTION_CATALOG, SECURITY_ACTION_CATALOG_ACTIONS, SECURITY_APPROVAL_ACTIONS, SECURITY_BOUNDARY_ACTIONS, validateSecurityActionCatalog, securityActionCatalogStatus,
  SECURITY_POLICY_AUDIT_EVIDENCE_VERSION, buildSecurityPolicyAuditEvidence,
  SECURITY_AGENT_HEALTH_LEVELS, buildSecurityAgentHealth,
  SECURITY_ALERT_POLICY_VERSION, SECURITY_ALERT_PRIORITY_ORDER, buildSecurityAlerts, SECURITY_ALERT_ROUTING_VERSION, SECURITY_ALERT_ROUTES, alertFingerprint, buildAlertRoutingPlan,
  acknowledgeAlert, SECURITY_NOTIFICATION_CONTRACT_VERSION, SECURITY_NOTIFICATION_EXTERNAL_CHANNELS, SECURITY_NOTIFICATION_INTERNAL_CHANNELS, sanitizeNotificationTask,
  sanitizeNotificationAuditRecord, MemoryNotificationAudit, createNoopNotificationAdapter, buildDefaultNoopAdapters, NotificationDispatcher, SECURITY_NOTIFICATION_SIMULATION_VERSION,
  validateNotificationAuditLimit, emptyNotificationSimulationStatus, SecurityNotificationSimulation, SECURITY_AI_ANALYST_CONTRACT_VERSION, SECURITY_AI_ANALYST_MODE,
  SECURITY_AI_ANALYST_SYSTEM_POLICY, SECURITY_AI_ANALYST_ASSESSMENTS, SECURITY_AI_ANALYST_PRIORITIES, SECURITY_AI_ANALYST_RECOMMENDED_ACTIONS, sanitizeIncidentForAi,
  sanitizeAlertForAi, sanitizeHealthForAi, buildAiAnalystInput, validateAiAnalystOutput, buildAiAnalystRequest, SECURITY_AI_ANALYST_MOCK_RUNNER_VERSION,
  createDeterministicMockAiProvider, emptyAiAnalystMockStatus, SecurityAiAnalystMockRunner, SECURITY_AI_MODEL_GATEWAY_VERSION, SECURITY_AI_MODEL_GATEWAY_DEFAULT_TIMEOUT_MS,
  buildModelGatewayConfig, SecurityAiModelGateway, SECURITY_AI_GROQ_PROVIDER_VERSION, buildGroqSecurityProviderConfig, SecurityAiGroqProvider, createGroqSecurityAiProvider,
  SECURITY_AI_PROVIDER_QUALITY_VERSION, SECURITY_AI_PROVIDER_QUALITY_CASES, evaluateAiProviderQuality, SECURITY_AI_LIVE_QUALITY_RUNNER_VERSION, buildAiLiveQualityRunnerConfig, runLiveAiProviderQuality,
  SECURITY_AI_SHADOW_INTEGRATION_VERSION, SECURITY_AI_SHADOW_ALLOWED_BACKENDS, buildAiShadowIntegrationConfig, SecurityAiShadowIntegration, createSecurityAiShadowIntegration,
  SECURITY_AI_ANALYSIS_ORCHESTRATOR_VERSION, SECURITY_AI_ANALYSIS_SEVERITY_RANK, buildAiAnalysisOrchestratorConfig, SecurityAiAnalysisOrchestrator, createSecurityAiAnalysisOrchestrator, publicAiAnalysisCycleResult,
  SECURITY_APPROVAL_GATE_VERSION, SECURITY_APPROVAL_STATES, SecurityApprovalGate,
  SECURITY_POLICY_ENGINE_VERSION, SECURITY_POLICY_DECISIONS, SECURITY_ACTION_POLICY, evaluateSecurityActionPolicy, evaluateSecurityAiPolicy, securityPolicyStatus,
  SECURITY_PHASE4_DEPLOYED_VALIDATION_VERSION, SECURITY_PHASE4_VALIDATION_ROUTES, buildPhase4DeployedValidationConfig, runPhase4DeployedValidation,
  runSecurityAgentWorker, sanitizeIncidentForStore, sanitizeSourceState, ShadowSecurityRunner, createShadowSecurityRunner, publicAiAnalysisResult,
  SECURITY_CENTER_MOUNT_VERSION, SECURITY_CENTER_DEFAULT_PREFIX, buildSecurityCenterMountConfig, createReadOnlySecurityCenterService, mountSecurityCenterRuntime,
  SECURITY_CENTER_STAGING_AUTH_VERSION, buildSecurityCenterStagingAuthConfig, createSecurityCenterStagingAuth,
  SecurityCenterService, createSecurityCenterHandlers, createSecurityCenterRouter, buildSecurityCenterOverview, pickIncident,
  normalizeSecurityEvent, sanitizeMeta, adaptLegacySecurityRecord, adaptLegacyViolation
};
