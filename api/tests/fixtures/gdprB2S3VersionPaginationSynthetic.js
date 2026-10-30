'use strict';

// TEST-ONLY MODEL of S3 ListObjectVersions response metadata/pagination.
// NO S3 SDK, provider, network, SQL, secrets, PII or real recovery GO.
// Inputs are STRICTLY normalized S3-shaped page envelopes from fake clients.
// An enumeration is not independent proof of completeness or retention.
const {keyFor}=require('./gdprB2VersionInventorySynthetic');

const BAD='GDPR_MODEL_B2_S3_PAGINATION_UNVERIFIED';
const MAX_PAGES=64,MAX_ENTRIES=512,MAX_PAGE_ITEMS=100;
const ID=/^[A-Za-z0-9._~+=-]{1,256}$/;
const NAME=/^[a-z0-9][a-z0-9.-]{2,62}$/;
const epoch=/^[A-Za-z0-9_-]{1,80}$/;
const fail=()=>{const e=Error(BAD);e.code=BAD;throw e;};
const shape=(v,keys)=>v && typeof v==='object' &&
  !Array.isArray(v) && Object.keys(v).sort().join(',')===keys;
const validCursor=(key,version)=>{
  return (key===null && version===null) ||
    (typeof key==='string' && key.length>0 && key.length<=512 &&
     typeof version==='string' && ID.test(version));
};
function verifySyntheticS3VersionPagination({
  journal,checkpoint,authority,pinReceipt,approvedBucket,
  pages,maxKeys=100
}={}) {
  try {
    if(!NAME.test(approvedBucket||'') ||
       !Number.isSafeInteger(maxKeys)||maxKeys<1||maxKeys>MAX_PAGE_ITEMS ||
       !journal || !epoch.test(journal.epoch||'') ||
       !authority || typeof authority.verify!=='function' ||
       !Array.isArray(pages)||pages.length===0||pages.length>MAX_PAGES)fail();
    // The synthetic pin authority is a separate MEMORY-ONLY fixture; never
    // mint receipts from untrusted ListObjectVersions response data.
    const pins=authority.verify(journal,checkpoint,pinReceipt);
    if(pins.length>MAX_ENTRIES)fail();
    const prefix='demos/gdpr-erasure/v1/events/'+journal.epoch+'/';
    let expectedKey=null,expectedVersion=null,previousKey=null,count=0;
    const markerPairs=new Set();
    const seen=new Set();
    for(let i=0;i<pages.length;i++){
      const page=pages[i];
      if(!shape(page,'DeleteMarkers,IsTruncated,KeyMarker,MaxKeys,Name,NextKeyMarker,NextVersionIdMarker,Prefix,VersionIdMarker,Versions') ||
         page.Name!==approvedBucket||page.Prefix!==prefix||
         page.MaxKeys!==maxKeys||typeof page.IsTruncated!=='boolean'||
         page.KeyMarker!==expectedKey ||
         page.VersionIdMarker!==expectedVersion ||
         !validCursor(page.KeyMarker,page.VersionIdMarker) ||
         !Array.isArray(page.Versions)||!Array.isArray(page.DeleteMarkers) ||
         page.Versions.length+page.DeleteMarkers.length>maxKeys ||
         page.Versions.length+page.DeleteMarkers.length>MAX_PAGE_ITEMS ||
         page.DeleteMarkers.length!==0)fail();
      // Hidden/delete-marker versions cannot be silently omitted from the
      // provider metadata view: any marker in the exact GDPR prefix is NO-GO.
      if((page.IsTruncated && (i===pages.length-1||
           page.Versions.length===0||
           !validCursor(page.NextKeyMarker,page.NextVersionIdMarker)||
           page.NextKeyMarker===null)) ||
         (!page.IsTruncated && (i!==pages.length-1||
           page.NextKeyMarker!==null||page.NextVersionIdMarker!==null)))
        fail();
      const currentPair=JSON.stringify([page.KeyMarker,page.VersionIdMarker]);
      if(markerPairs.has(currentPair))fail();
      markerPairs.add(currentPair);
      if(page.IsTruncated){
        const nextPair=JSON.stringify([page.NextKeyMarker,page.NextVersionIdMarker]);
        if(nextPair===currentPair||markerPairs.has(nextPair))fail();
      }
      for(const v of page.Versions){
        if(!shape(v,'IsLatest,Key,Size,VersionId') ||
           typeof v.Key!=='string'||!v.Key.startsWith(prefix)||
           !ID.test(v.VersionId||'') ||
           !Number.isSafeInteger(v.Size)||v.Size<1||v.Size>4096||
           typeof v.IsLatest!=='boolean' ||
           seen.has(JSON.stringify([v.Key,v.VersionId])))fail();
        // Normalized model requires exactly the version known to the
        // independent pin receipt. Extra versions (including older
        // noncurrent versions) remain NO-GO pending explicit reconciliation.
        const expected=pins[count];
        if(!expected || v.Key!==keyFor(journal.epoch,count+1) ||
           v.Key!==expected.Key ||
           v.VersionId!==expected.VersionId ||
           v.Size!==expected.ContentLength ||
           v.IsLatest!==true ||
           (previousKey!==null && !(v.Key>previousKey)))fail();
        previousKey=v.Key;
        seen.add(JSON.stringify([v.Key,v.VersionId]));
        count++;
      }
      // In this normalized, delete-marker-free model, the continuation
      // cursor must identify the last returned version, not merely be
      // repeated by the next page. Otherwise a fabricated cursor can be
      // accepted even though the provider has not proved page continuity.
      // This is NOT a substitute for independent provider completeness.
      if(page.IsTruncated){
        const last=page.Versions[page.Versions.length-1];
        if(!last || page.NextKeyMarker!==last.Key ||
           page.NextVersionIdMarker!==last.VersionId)fail();
      }
      expectedKey=page.NextKeyMarker;
      expectedVersion=page.NextVersionIdMarker;
    }
    if(count!==pins.length||expectedKey!==null||expectedVersion!==null ||
       checkpoint?.count!==pins.length)fail();
    return Object.freeze({
      syntheticS3VersionPaginationVerified:true,
      inspectedVersions:count,
      inspectedPages:pages.length,
      productionRecoveryReady:false,
      externalProviderAttested:false,
      completeGdprJournalVerified:false,
      perVersionRetentionVerified:false,
      isolatedRestoreVerified:false
    });
  }catch(_){fail();}
}
module.exports={BAD,verifySyntheticS3VersionPagination};
