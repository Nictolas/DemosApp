'use strict';

// Explicit one-shot CLI; NEVER import this from api/index.js or api/server.js.
// Its SELECT observes a fresh staging SQL session using the same DB config
// as the backend, NOT an existing session in a running Render backend.
// Draft only: no Render execution, deploy or credential changes authorized.
const {assertProcessTarget} =
  require('../services/gdprRenderInProcessStagingAttestation');
const {SQL, publicReport} = require('./attest-gdpr-writer-readonly');

const CLI_MARKER = 'demos-staging-isolated-cli-readonly-20261029';
const LOG_PREFIX = 'GDPR_RENDER_STAGING_ISOLATED_SQL_IDENTITY ';
const BAD_CONFIG = 'NO_GO_ISOLATED_CLI_GUARD_FAILED';

const EXPECTED_SQL_ROLE = 'demos_staging_runtime';

// Catalog-only gate: a privileged postgres/BYPASSRLS identity must never
// be described as an expected staging application writer. Policy outcomes,
// external connections and the running Render web pool remain UNATTESTED.
function catalogMatchesStagingRuntime(state) {
  return state?.current_role === EXPECTED_SQL_ROLE &&
    state.session_role === EXPECTED_SQL_ROLE &&
    state.database_name === 'postgres' &&
    state.bypass_rls === false &&
    state.ledger_owner === false &&
    state.ledger_present === true &&
    state.ledger_rls === true &&
    state.ledger_force_rls === true &&
    state.ledger_insert_grant === true &&
    state.ledger_select_grant === true &&
    state.public_grants_exist === false &&
    state.public_column_grants_exist === false &&
    state.api_roles_with_dml_grants === 0;
}

function assertIsolatedTarget(env) {
  if (env?.GDPR_RENDER_SQL_CLI_ONLY !== CLI_MARKER ||
      env.GDPR_RENDER_INPROCESS_ATTESTATION !==
        'demos-staging-inprocess-readonly-20261029') {
    throw Error(BAD_CONFIG);
  }
  // Same immutable staging service/SQL target and deny-lists as the Draft
  // guard, run before loading PostgreSQL libraries or creating a connection.
  try { assertProcessTarget(env); }
  catch (_) { throw Error(BAD_CONFIG); }
  return { service:'demos-functional-staging', project:'Demos-Staging' };
}

function failedReport() {
  return Object.freeze({
    service:'demos-functional-staging', project:'Demos-Staging',
    execution:'ISOLATED_CLI_NOT_RUNNING_BACKEND',
    least_privilege_catalog_match:false,
    isolated_cli_staging_session_observed:false,
    in_process_staging_session_observed:false,
    sql_writer_attested:false,
    live_production_pool_verified:false,
    live_render_pool_verified:false,
    recoveryReady:false,
    status:'NO_GO_ISOLATED_CLI_SQL_NOT_ATTESTED'
  });
}

async function runIsolatedProbe({env, loadDatabase, emit}) {
  try { assertIsolatedTarget(env); }
  catch (_) {
    const report=failedReport();
    emit?.(LOG_PREFIX+JSON.stringify(report));
    return report;
  }

  // The DB module is imported ONLY after validation. It imports pg and the
  // canonical TLS policy, never app.js, server.js, Firebase or background jobs.
  let database,client;
  try {
    database=loadDatabase();
    client=await database.getPool().connect();
    const result=await client.query({
      text:SQL, rowMode:'object', query_timeout:5000
    });
    const catalog=publicReport(result.rows);
    const roleExpected=catalogMatchesStagingRuntime(result.rows?.[0]);
    const report={
      ...catalog,
      service:'demos-functional-staging',
      execution:'ISOLATED_CLI_NOT_RUNNING_BACKEND',
      least_privilege_catalog_match:roleExpected,
      isolated_cli_staging_session_observed:
        catalog.sql_writer_attested===true,
      // A standalone CLI cannot attest the currently RUNNING Render
      // application SQL pool or that any real writer succeeds.
      in_process_staging_session_observed:false,
      sql_writer_attested:false,
      live_production_pool_verified:false,
      live_render_pool_verified:false,
      recoveryReady:false,
      status:!catalog.ledger_present || !catalog.sql_writer_attested
        ? 'NO_GO_ISOLATED_CLI_SQL_NOT_ATTESTED'
        : roleExpected
          ? 'READONLY_EXPECTED_STAGING_ROLE_NOT_RUNTIME'
          : 'NO_GO_STAGING_SQL_ROLE_OR_LEDGER_PRIVILEGES_MISMATCH'
    };
    emit?.(LOG_PREFIX+JSON.stringify(report));
    return report;
  }catch(_){
    // SQL/SSL/driver exceptions can contain URLs, usernames and secrets.
    // Never log their message/stack or serialize the thrown object.
    const report=failedReport();
    emit?.(LOG_PREFIX+JSON.stringify(report));
    return report;
  }finally{
    if(client)try{client.release();}catch(_){}
    if(database)try{await database.closePool();}catch(_){}
  }
}

if(require.main===module){
  // Only execute when an operator invokes THIS script intentionally, not
  // when a web service starts. The CLI terminates with a NO-GO code even on
  // a successful SELECT: a role observation is not a recovery approval.
  runIsolatedProbe({
    env:process.env,
    loadDatabase:()=>require('../config/database'),
    emit:line=>process.stdout.write(line+'\n')
  }).then(()=>{process.exitCode=2;}).catch(()=>{
    process.stderr.write('NO_GO_ISOLATED_CLI_UNEXPECTED_FAILURE\n');
    process.exitCode=2;
  });
}

module.exports={
  assertIsolatedTarget,runIsolatedProbe,CLI_MARKER,LOG_PREFIX,
  catalogMatchesStagingRuntime,EXPECTED_SQL_ROLE
};
