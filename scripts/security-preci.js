const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const steps = [['git', ['diff', '--check'], root, 'Git whitespace/conflict check']];

const securityAgentDir = path.join(root, 'api', 'security-agent');
const securityTestDir = path.join(root, 'api', 'tests');
for (const file of fs.readdirSync(securityAgentDir).filter(name => name.endsWith('.js')).sort()) {
  steps.push([process.execPath, ['--check', path.join(securityAgentDir, file)], root, `Syntax ${file}`]);
}
for (const file of fs.readdirSync(securityTestDir).filter(name => /^security.*\.test\.js$/i.test(name)).sort()) {
  steps.push([process.execPath, ['--check', path.join(securityTestDir, file)], root, `Syntax ${file}`]);
}

function npmStep(cwd, script, label) {
  if (process.platform === 'win32') {
    return [process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', `npm run ${script}`], cwd, label];
  }
  return ['npm', ['run', script], cwd, label];
}
steps.push(npmStep(path.join(root, 'api'), 'test:security-agent', 'Security Agent test suite'));
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityDetectionCoverage.test.js')], root, 'Deterministic detection coverage']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securitySeverityPrioritySafety.test.js')], root, 'Severity and priority safety']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityIncidentLifecycleSafety.test.js')], root, 'Incident lifecycle safety']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityPostgresLifecycleSafety.test.js')], root, 'Postgres lifecycle safety']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityPostgresTemporalSafety.test.js')], root, 'Postgres temporal safety']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityPostgresSourceStateSafety.test.js')], root, 'Postgres source-state safety']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityShadowRunnerPersistenceSafety.test.js')], root, 'Shadow runner persistence safety']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityMemoryStoreConsistency.test.js')], root, 'Memory store consistency']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityStoreSharedContract.test.js')], root, 'Shared store contract']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityStoreRetentionContract.test.js')], root, 'Store retention contract']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityStoreReadParity.test.js')], root, 'Store read parity']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securitySourceStateReadParity.test.js')], root, 'Source-state read parity']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityStoreConfigurationSafety.test.js')], root, 'Store configuration safety']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityPostgresRowValidation.test.js')], root, 'Postgres row validation']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityPostgresStatsValidation.test.js')], root, 'Postgres stats validation']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityPostgresResultShapeSafety.test.js')], root, 'Postgres result shape safety']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityFoundationInvariantScan.test.js')], root, 'Foundation invariant scan']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityTelemetryProviderReadiness.test.js')], root, 'Telemetry/provider readiness']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityStagingIsolation.test.js')], root, 'Non-production staging isolation']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityActionCatalog.test.js')], root, 'Security action catalog drift gate']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityPolicyAuditEvidence.test.js')], root, 'Policy/audit evidence consistency']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityAiQualityEvaluation.test.js')], root, 'AI provider quality evaluation']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityAiLiveQualityRunner.test.js')], root, 'Live AI quality runner gate']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityPhase4DeployedValidation.test.js')], root, 'Phase 4 deployed validation harness']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityCenterRuntimeMount.test.js')], root, 'Security Center runtime mount gate']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityCenterStagingAuth.test.js')], root, 'Security Center staging auth gate']);
steps.push([process.execPath, ['--test', path.join(root, 'api', 'tests', 'securityCenterStagingServer.test.js')], root, 'Security Center dedicated staging server gate']);
steps.push(npmStep(path.join(root, 'api'), 'test:firebase-admin-compat', 'Firebase Admin 14 compatibility'));
steps.push(npmStep(path.join(root, 'client'), 'build', 'Client production build'));

for (const [command, args, cwd, label] of steps) {
  process.stdout.write(`\n[pre-CI] ${label}\n`);
  const result = spawnSync(command, args, { cwd, stdio: 'inherit', shell: false });
  if (result.error) { console.error(`[pre-CI] ERROR: ${label}: ${result.error.message}`); process.exit(1); }
  if (result.status !== 0) { console.error(`[pre-CI] FAIL: ${label}`); process.exit(result.status || 1); }
}

console.log('\n[pre-CI] PASS: local security gate is green. No network, deploy, migration, production write, or GitHub Action was started by this script.');
