'use strict';

// Isolated operator-only B2 bucket METADATA check. Never query GDPR event
// rows, object keys, DB, Render, Firebase, Axiom or any application endpoint.
// NO evidence of a complete/fresh GDPR journal or replay is produced here.
const {
  S3Client, GetBucketVersioningCommand, GetObjectLockConfigurationCommand
}=require('@aws-sdk/client-s3');

const MARKER='demos-gdpr-b2-isolated-metadata-readonly-v1';
const BAD='NO_GO_GDPR_B2_METADATA_PRECHECK_FAILED';
const CLOSED='NO_GO_GDPR_B2_METADATA_UNVERIFIED';
const MAX_PROBE_MS=15000;
const NEVER_READY=Object.freeze({
  recoveryReady:false,
  restoreTestVerified:false,
  completeGdprJournalVerified:false,
  objectVersionsVerified:false,
  liveProductionIsolationVerified:false,
  scope:'DEDICATED_GDPR_B2_BUCKET_METADATA_ONLY'
});
const isSet=val=>typeof val==='string' && val.length>0;

function assertSafeEnvironment(env) {
  if(!env || env.GDPR_B2_METADATA_PROBE!==MARKER ||
    env.RENDER || env.RENDER_SERVICE_ID ||
    [
      'DATABASE_URL','SUPABASE_DB_URL','AUDIT_OUTBOX_DATABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY','AXIOM_API_TOKEN','AXIOM_ORG_ID',
      'B2_S3_ACCESS_KEY_ID','B2_S3_SECRET_ACCESS_KEY',
      'B2_APPLICATION_KEY_ID','B2_APPLICATION_KEY',
      'GDPR_LEDGER_B2_ACCESS_KEY_ID','GDPR_LEDGER_B2_SECRET_ACCESS_KEY'
    ].some(name=>isSet(env[name])) ||
    ['GDPR_LEDGER_B2_ENABLED','GDPR_ERASURE_OUTBOX_ENABLED',
      'GDPR_ERASURE_OUTBOX_WORKER_ENABLED','AXIOM_ARCHIVE_ENABLED'
    ].some(name=>env[name]==='true')) {
    throw Error(BAD);
  }
  const bucket=env.GDPR_B2_READONLY_BUCKET;
  const confirmedBucket=env.GDPR_B2_READONLY_APPROVED_BUCKET;
  const region=env.GDPR_B2_READONLY_REGION;
  const endpoint=env.GDPR_B2_READONLY_ENDPOINT;
  const accessKeyId=env.GDPR_B2_READONLY_ACCESS_KEY_ID;
  const secretAccessKey=env.GDPR_B2_READONLY_SECRET_ACCESS_KEY;
  const minRetentionDays=Number(env.GDPR_B2_READONLY_MIN_RETENTION_DAYS);
  if(!/^[a-z0-9][a-z0-9.-]{2,62}$/.test(bucket||'') ||
    bucket!==confirmedBucket ||
    bucket===env.B2_BUCKET_NAME ||
    bucket==='demos-log-archive-eu' ||
    !/^[a-z0-9-]+$/.test(region||'') ||
    !isSet(accessKeyId) || !isSet(secretAccessKey) ||
    !Number.isSafeInteger(minRetentionDays) ||
    minRetentionDays<1 || minRetentionDays>3000) throw Error(BAD);
  let url;
  try { url=new URL(endpoint); } catch (_) { throw Error(BAD); }
  const hostname=/^s3\.([a-z0-9-]+)\.backblazeb2\.com$/.exec(url.hostname);
  if(url.protocol!=='https:' || !hostname || hostname[1]!==region ||
    url.port || url.username || url.password || url.pathname!=='/' ||
    url.search || url.hash) throw Error(BAD);
  return {bucket,region,endpoint,accessKeyId,secretAccessKey,minRetentionDays};
}

function readOnlyTransport(client, bucket) {
  if(!client || typeof client.send!=='function') throw Error(BAD);
  return {send(command,options=undefined) {
    // A read-only call cannot override the bucket, SDK request options,
    // deadline, or escape into a mutating/listing operation.
    const allowedOptions=options===undefined ||
      (options && typeof options==='object' && !Array.isArray(options) &&
       Object.keys(options).join(',')==='abortSignal' &&
       options.abortSignal instanceof AbortSignal);
    if(!allowedOptions ||
      !(command instanceof GetBucketVersioningCommand) &&
      !(command instanceof GetObjectLockConfigurationCommand) ||
      !command.input || Object.keys(command.input).join(',')!=='Bucket' ||
      command.input.Bucket!==bucket) {
      throw Error('NO_GO_GDPR_B2_NON_READONLY_OPERATION_REJECTED');
    }
    return client.send(command,options);
  }};
}

function safeReport(status, extra={}) {
  return {status,...NEVER_READY,
    bucketMetadataVerified:false,complianceDefaultVerified:false,
    ...extra};
}

async function runReadOnlyBucketProbe({
  env=process.env,
  timeoutMs=MAX_PROBE_MS,
  makeClient=cfg=>new S3Client({
    endpoint:cfg.endpoint,region:cfg.region,forcePathStyle:true,
    maxAttempts:2,
    credentials:{accessKeyId:cfg.accessKeyId,
      secretAccessKey:cfg.secretAccessKey}
  })
}={}) {
  let cfg;
  try {
    cfg=assertSafeEnvironment(env);
    if(!Number.isSafeInteger(timeoutMs) || timeoutMs<1 ||
       timeoutMs>MAX_PROBE_MS) throw Error(BAD);
  } catch (_) { return safeReport(BAD); }

  let client, timer;
  const controller=new AbortController();
  const deadline=new Promise((_,reject)=>{
    timer=setTimeout(()=>{
      controller.abort();
      reject(Error(CLOSED));
    },timeoutMs);
  });
  try {
    client=makeClient(cfg);
    const reader=readOnlyTransport(client,cfg.bucket);
    // A SINGLE wall-clock budget covers both metadata reads.
    const versions=await Promise.race([
      reader.send(new GetBucketVersioningCommand({Bucket:cfg.bucket}),
        {abortSignal:controller.signal}),deadline
    ]);
    if(controller.signal.aborted)throw Error(CLOSED);
    const locked=await Promise.race([
      reader.send(new GetObjectLockConfigurationCommand({Bucket:cfg.bucket}),
        {abortSignal:controller.signal}),deadline
    ]);
    if(controller.signal.aborted)throw Error(CLOSED);
    // The responses describe bucket defaults, NOT retention on a specific
    // immutable event version. Require COMPLIANCE, not GOVERNANCE.
    const defaultRule=locked?.ObjectLockConfiguration?.Rule?.DefaultRetention;
    const enabled=versions?.Status==='Enabled';
    const compliance=locked?.ObjectLockConfiguration?.ObjectLockEnabled==='Enabled' &&
      defaultRule?.Mode==='COMPLIANCE' &&
      Number.isSafeInteger(defaultRule.Days) &&
      defaultRule.Days>=cfg.minRetentionDays &&
      defaultRule.Days<=3000;
    if(!enabled || !compliance)return safeReport(CLOSED,{
      bucketVersioningEnabled:enabled,complianceDefaultVerified:compliance
    });
    return safeReport('READONLY_BUCKET_METADATA_COMPLIANCE_NOT_RECOVERY',{
      bucketMetadataVerified:true,bucketVersioningEnabled:true,
      complianceDefaultVerified:true
    });
  }catch(_){
    // Never expose SDK errors, URL, bucket, key IDs or response contents.
    return safeReport(CLOSED);
  }finally{
    clearTimeout(timer);
    controller.abort();
    try{client?.destroy?.();}catch(_){/* do not leak provider errors */}
  }
}

if(require.main===module){
  runReadOnlyBucketProbe().then(result=>{
    console.log(JSON.stringify(result));
    // Even fully protected bucket metadata does NOT certify recovery.
    process.exitCode=2;
  }).catch(()=>{
    console.error(BAD);
    process.exitCode=2;
  });
}
module.exports={
  MARKER,BAD,CLOSED,assertSafeEnvironment,readOnlyTransport,
  runReadOnlyBucketProbe,MAX_PROBE_MS
};
