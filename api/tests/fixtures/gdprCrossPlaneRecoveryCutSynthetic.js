'use strict';
// SYNTHETIC ONLY. Offline integration of pre-existing B2 version/pin/retention
// and SQL replay fixtures with an explicit common journal cut. No actual
// backup provenance, provider evidence, credentials, SQL, B2 or recovery GO.
const crypto=require('node:crypto');
const {SyntheticDatabase,restoreSyntheticSnapshot}=
  require('./gdprDurableRecoveryPrototype');
const {verifySyntheticPinnedB2VersionRetention}=
  require('./gdprB2VersionRetentionSynthetic');
const ZERO='0'.repeat(64);
const HEX=/^[0-9a-f]{64}$/;
const fail=()=>{const e=Error('GDPR_MODEL_CROSS_PLANE_CUT_UNVERIFIED');
  e.code=e.message;throw e;};
const sha=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const exact=(x,keys)=>x && typeof x==='object' && !Array.isArray(x) &&
  Object.keys(x).sort().join(',')===keys;
const fingerprint=op=>sha({id:op.id,subject:op.subject,action:op.action});
function snapshotDigest(snapshot){
  if(!(snapshot instanceof SyntheticDatabase) ||
      !(snapshot.applied instanceof Map) ||
      !exact(snapshot.accounts,Object.keys(snapshot.accounts).sort().join(',')) ||
      Object.keys(snapshot.accounts).length>128 || snapshot.applied.size>512)
    fail();
  const accounts=Object.keys(snapshot.accounts).sort().map(id=>{
    const a=snapshot.accounts[id];
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(id) ||
       !exact(a,'consent,exists') ||
       typeof a.exists!=='boolean'||typeof a.consent!=='boolean') fail();
    return [id,a.exists,a.consent];
  });
  const applied=[...snapshot.applied.entries()].sort(([a],[b])=>a.localeCompare(b));
  for(const [id,digest] of applied)
    if(!/^[A-Za-z0-9_-]{1,80}$/.test(id)||!HEX.test(digest))fail();
  return sha({accounts,applied});
}
function syntheticManifest(snapshot,journal,journalCount,overrides={}) {
  const head=journalCount===0?ZERO:journal.entries[journalCount-1]?.hash;
  return {backupId:'synthetic-sql-backup-1',postgresSystemId:'synthetic-pg17',
    postgresTimeline:1,postgresLsn:'0/00000010',
    journalEpoch:journal.epoch,journalCount,journalHead:head,
    snapshotSha256:snapshotDigest(snapshot),...overrides};
}
function verifySyntheticCrossPlaneRecoveryCut({
  snapshot,manifest,journal,checkpoint,pages,authority,pinReceipt,
  retentions,approvedBucket,startedAt,endedAt,minimumRemainingDays,
  writersFenced=false,ingressBlocked=false,providersQuarantined=false
}={}) {
  try {
    if(!exact(manifest,'backupId,journalCount,journalEpoch,journalHead,postgresLsn,postgresSystemId,postgresTimeline,snapshotSha256') ||
       typeof manifest.backupId!=='string'||
       !/^synthetic-[A-Za-z0-9_-]{1,80}$/.test(manifest.backupId) ||
       manifest.postgresSystemId!=='synthetic-pg17' ||
       !Number.isSafeInteger(manifest.postgresTimeline) ||
       manifest.postgresTimeline<1 ||
       !/^[0-9A-F]{1,8}\/[0-9A-F]{8}$/.test(manifest.postgresLsn||'') ||
       manifest.journalEpoch!==journal?.epoch ||
       !Number.isSafeInteger(manifest.journalCount) ||
       manifest.journalCount<0 || manifest.journalCount>512 ||
       !HEX.test(manifest.journalHead||'') ||
       !HEX.test(manifest.snapshotSha256||'') ||
       !writersFenced || !ingressBlocked || !providersQuarantined) fail();
    // Do NOT trust the user-supplied manifest to establish a B2 authority.
    // Verify the existing independent (still simulated) pin/checkpoint and
    // every version's invented COMPLIANCE retention first.
    const inventory=verifySyntheticPinnedB2VersionRetention({
      journal,checkpoint,pages,authority,pinReceipt,retentions,
      approvedBucket,startedAt,endedAt,minimumRemainingDays
    });
    if(manifest.journalCount>checkpoint.count ||
       manifest.journalHead!==(manifest.journalCount===0?ZERO:
         journal.entries[manifest.journalCount-1]?.hash) ||
       manifest.snapshotSha256!==snapshotDigest(snapshot))fail();
    // No "partially prepared" SQL cut can be admitted from a truncated
    // journal; the exporter must have an unambiguous committed prefix.
    const pending=new Map();
    const prefix=new Map();
    for(const e of journal.entries.slice(0,manifest.journalCount)){
      const fp=fingerprint(e.operation);
      if(e.phase==='prepare') {
        if(pending.has(e.operation.id)||prefix.has(e.operation.id))fail();
        pending.set(e.operation.id,fp);
      } else if(e.phase==='commit') {
        if(pending.get(e.operation.id)!==fp)fail();
        pending.delete(e.operation.id);
        prefix.set(e.operation.id,fp);
      } else fail();
    }
    if(pending.size || snapshot.applied.size!==prefix.size)fail();
    for(const [id,fp] of prefix)
      if(snapshot.applied.get(id)!==fp)fail();
    const replay=restoreSyntheticSnapshot(snapshot,journal,{
      writersFenced,ingressBlocked,providersQuarantined,
      independentWitness:checkpoint
    });
    return Object.freeze({
      syntheticCrossPlaneCutVerified:true,
      syntheticReplayedOperations:replay.replayed,
      syntheticPinnedVersions:inventory.inspectedVersions,
      syntheticBackupHash:manifest.snapshotSha256,
      productionRecoveryReady:false,
      backupProvenanceVerified:false,
      completeGdprJournalVerified:false,
      externalProviderAttested:false,
      isolatedRestoreVerified:false
    });
  } catch (_) {fail();}
}
module.exports={snapshotDigest,syntheticManifest,
  verifySyntheticCrossPlaneRecoveryCut};
