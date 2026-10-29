'use strict';

// Offline, source-only audit of the EXISTING functional-staging GitHub branch.
// No Render API, Supabase, SQL connections, environment secrets, deployment,
// live service operation, branch mutation, or production user data.
const test=require('node:test');
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {MUTATING_STAGING_E2E_FLAGS,STAGING_BACKGROUND_JOB_FLAGS}=
  require('../services/gdprRenderInProcessStagingAttestation');

const AUDIT_REF='refs/remotes/origin/gdpr-audit-functional-staging';
function source(file){
  if(process.env.GITHUB_ACTIONS!=='true')throw Error('STAGING_SOURCE_AUDIT_CI_ONLY');
  // Input is a fixed Git ref/path, never shell interpolation or a user URL.
  return execFileSync('git',['show',AUDIT_REF+':'+file],{
    encoding:'utf8',timeout:5000,maxBuffer:120000
  }).replace(/^\uFEFF/,'');
}

test('review only: live staging branch has a separate boot migration gate',()=>{
  const entry=source('api/index.js');
  const boot=source('api/scripts/stagingBoot.js');
  const migrate=source('api/scripts/stagingMigrate.js');
  assert.match(entry,/runStagingBootGate/);
  assert.ok(entry.indexOf('await runStagingBootGate()')<
    entry.indexOf("require('./server')"),
    'migrations can execute BEFORE application/server load');
  assert.match(boot,/env.NODE_ENV !== 'staging'/);
  assert.match(boot,/DEMOS_STAGING_MIGRATION_MODE/);
  assert.match(boot,/e2e-seed/);
  assert.match(migrate,/const EXPECTED_DATABASE = 'demos_civic_staging_db'/);
  assert.match(migrate,/client\.query|pool\.query/);
  // This incompatible staging migration DB is NOT the Supabase Demos-Staging
  // /postgres database accepted by the separate read-only identity probe.
});

test('existing staging server writer flags are ALL covered by probe deny-list',()=>{
  const server=source('api/server.js');
  const flags=[...new Set([...server.matchAll(
    /process\.env\.(DEMOS_STAGING_[A-Z0-9_]+_E2E)/g
  )].map(m=>m[1]))].sort();
  assert.equal(flags.length,9,'new staging writer modes require fresh audit');
  assert.deepEqual(flags,[...MUTATING_STAGING_E2E_FLAGS].sort());
  assert.match(server,/initializeFirebaseAdmin/);
  // Presence of Firebase Admin proves a separate provider initializer exists,
  // NOT which Firebase project or credentials are live on Render.
});

test('all opt-in staging background jobs are included in the probe deny-list',()=>{
  const app=source('api/app.js');
  const matches=[...new Set([...app.matchAll(
    /process\.env\.((?:ENABLE_[A-Z0-9_]+|AXIOM_ARCHIVE_ENABLED)) === 'true'/g
  )].map(m=>m[1]))].sort();
  assert.deepEqual(matches,[...STAGING_BACKGROUND_JOB_FLAGS].sort(),
    'new staging job modes require fresh source-level audit');
  assert.match(app,/auditManager\.start\(\)/);
  assert.match(app,/performanceOptimizer\.start\(\)/);
  // Unconditional audit/optimizers and Firebase Admin are STILL in startup:
  // no code-level guard proves every external provider to be readonly.
});

test('source audit remains NO-GO and cannot certify provider isolation',()=>{
  const entry=source('api/index.js');
  assert.doesNotMatch(entry,/gdprRenderInProcessStagingAttestation/);
  // The staging branch must not be falsely called prepared for the Draft-only
  // identity probe. A code change to staging requires a renewed assessment.
  const summary={
    sourceOnly:true,
    stagingProbePresent:false,
    providerCredentialsVerified:false,
    renderLivePoolVerified:false,
    stagingDeployAuthorized:false,
    recoveryReady:false,
    status:'NO_GO_STAGING_BRANCH_AND_PROVIDER_ISOLATION_NOT_ATTESTED'
  };
  assert.equal(summary.recoveryReady,false);
  assert.equal(summary.stagingDeployAuthorized,false);
  assert.match(summary.status,/^NO_GO/);
});
