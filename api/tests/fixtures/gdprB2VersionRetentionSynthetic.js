'use strict';

// SYNTHETIC ONLY. Cross-check a COMPLETE, independently pinned invented
// version inventory against invented per-version COMPLIANCE retention replies.
// No SDK, provider, SQL, user data, credentials or production recovery GO.
const {verifySyntheticPinnedB2Inventory} =
  require('./gdprB2IndependentVersionPinsSynthetic');
const BAD='GDPR_MODEL_B2_PER_VERSION_RETENTION_UNVERIFIED';
const MS_DAY=86400000;
const MAX_SCAN_MS=600000;
const fail=()=>{const e=new Error(BAD);e.code=BAD;throw e;};
const bucketName=b=>typeof b==='string' &&
  /^[a-z0-9][a-z0-9.-]{2,62}$/.test(b);
const validDate=d=>d instanceof Date && Number.isFinite(d.getTime());
const allowedFields='Bucket,Key,Mode,RetainUntilDate,VersionId';

function verifySyntheticPinnedB2VersionRetention({
  journal,checkpoint,pages,authority,pinReceipt,retentions,
  approvedBucket,startedAt,endedAt,minimumRemainingDays
}={}) {
  try {
    if (!bucketName(approvedBucket) ||
        !Number.isSafeInteger(minimumRemainingDays) ||
        minimumRemainingDays < 1 || minimumRemainingDays > 3000 ||
        !validDate(startedAt) || !validDate(endedAt) ||
        endedAt.getTime() < startedAt.getTime() ||
        endedAt.getTime() - startedAt.getTime() > MAX_SCAN_MS ||
        !Array.isArray(retentions) || retentions.length > 512) fail();

    // The pin authority and journal witness are both MEMORY-ONLY fixtures.
    // Validation precedes any reliance on the untrusted retention records.
    const result=verifySyntheticPinnedB2Inventory(
      journal,checkpoint,pages,authority,pinReceipt);
    const listed=pages.flatMap(page=>page.objects);
    if (retentions.length !== listed.length) fail();
    const minUntil=endedAt.getTime()+minimumRemainingDays*MS_DAY;
    for (let i=0; i<listed.length; i++) {
      const record=retentions[i], version=listed[i];
      if (!record || Array.isArray(record) ||
          typeof record !== 'object' ||
          Object.keys(record).sort().join(',')!==allowedFields ||
          record.Bucket!==approvedBucket ||
          record.Key!==version.Key ||
          record.VersionId!==version.VersionId ||
          record.Mode!=='COMPLIANCE' ||
          typeof record.RetainUntilDate!=='string') fail();
      const until=new Date(record.RetainUntilDate);
      if (!Number.isFinite(until.getTime()) ||
          until.toISOString()!==record.RetainUntilDate ||
          until.getTime()<=minUntil) fail();
    }
    return Object.freeze({
      ...result,
      syntheticPerVersionComplianceRetentionVerified:true,
      inspectedRetentions:retentions.length,
      // These never become true merely because invented data is coherent.
      productionRecoveryReady:false,
      completeGdprJournalVerified:false,
      externalProviderAttested:false,
      isolatedRestoreVerified:false
    });
  } catch (_) { fail(); }
}
module.exports={BAD,verifySyntheticPinnedB2VersionRetention};
