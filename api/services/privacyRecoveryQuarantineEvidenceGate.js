'use strict';

// OFFLINE EVIDENCE PACKAGER. This does not contact any provider, attest that
// a claim is true, start a restore, or authorize unquarantining production.
// An operator must independently verify each reference in the incident channel.
const MAX_EVIDENCE_AGE_MS = 15 * 60 * 1000;
const FUTURE_SKEW_MS = 60 * 1000;
const REQUIRED_CONTROLS = Object.freeze({
  renderIngressIsolation: 'render_dashboard',
  renderIngressProbe: 'independent_probe',
  renderWorkersStopped: 'render_dashboard',
  renderInFlightDrained: 'independent_probe',
  renderStagingCredentialsMapped: 'operator_credential_inventory',
  supabaseDataApiDisabled: 'supabase_dashboard',
  supabaseDataApiProbe: 'independent_probe',
  supabasePostgresAndPoolerIsolation: 'supabase_dashboard',
  supabaseDatabaseProbe: 'independent_probe',
  supabaseOtherManagedEndpoints: 'operator_provider_inventory',
  externalClientsAndCiStopped: 'operator_credential_inventory',
  approvedBackupCutoff: 'provider_backup_metadata',
  independentLedgerFreshness: 'independent_ledger_pin',
  b2ImmutableVersionReadback: 'b2_version_readback',
  controllerAndDpoApproval: 'controller_dpo_approval'
});
const RECOVERY_ID = /^[a-zA-Z0-9_-]{8,100}$/;
const EVIDENCE_REF = /^[a-zA-Z0-9_.:/#-]{8,160}$/;

function assessQuarantineEvidence(payload, { now = new Date() } = {}) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw Error('Invalid offline assessment clock');
  }
  // The output is deliberately non-sensitive and contains no evidence refs,
  // identities, service paths, URLs, addresses, or provider credentials.
  const blockers = [];
  if (!payload || typeof payload !== 'object' || Array.isArray(payload) ||
      typeof payload.recoveryId !== 'string' || !RECOVERY_ID.test(payload.recoveryId)) {
    return { decision: 'NO_GO', blockers: ['INVALID_RECOVERY_ID'], checked: 0,
      required: Object.keys(REQUIRED_CONTROLS).length };
  }
  const controls = payload.controls;
  if (!controls || typeof controls !== 'object' || Array.isArray(controls)) {
    return { decision: 'NO_GO', blockers: ['MISSING_EVIDENCE_CONTROLS'], checked: 0,
      required: Object.keys(REQUIRED_CONTROLS).length };
  }
  for (const name of Object.keys(controls)) {
    if (!Object.prototype.hasOwnProperty.call(REQUIRED_CONTROLS, name)) {
      blockers.push('UNKNOWN_CONTROL');
      break;
    }
  }
  let checked = 0;
  for (const [key, sourceType] of Object.entries(REQUIRED_CONTROLS)) {
    const item = Object.prototype.hasOwnProperty.call(controls, key) ? controls[key] : null;
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      blockers.push('MISSING:' + key);
      continue;
    }
    if (item.verified !== true || item.scope !== 'production' ||
        item.recoveryId !== payload.recoveryId || item.sourceType !== sourceType ||
        typeof item.reference !== 'string' || !EVIDENCE_REF.test(item.reference)) {
      blockers.push('UNVERIFIED:' + key);
      continue;
    }
    const observedAt = typeof item.observedAt === 'string' ? new Date(item.observedAt) : null;
    if (!observedAt || !Number.isFinite(observedAt.getTime()) ||
        observedAt.toISOString() !== item.observedAt ||
        observedAt.getTime() > now.getTime() + FUTURE_SKEW_MS ||
        now.getTime() - observedAt.getTime() > MAX_EVIDENCE_AGE_MS) {
      blockers.push('STALE_OR_INVALID_TIME:' + key);
      continue;
    }
    checked++;
  }
  if (blockers.length > 0) {
    return { decision: 'NO_GO', blockers, checked, required: Object.keys(REQUIRED_CONTROLS).length };
  }
  // No code path may emit GO: human reviewers and actual provider isolation
  // are mandatory. A self-declared JSON package is never proof of quarantine.
  return { decision: 'MANUAL_INDEPENDENT_REVIEW_REQUIRED', blockers: [],
    checked, required: Object.keys(REQUIRED_CONTROLS).length };
}

module.exports = { assessQuarantineEvidence, REQUIRED_CONTROLS };
