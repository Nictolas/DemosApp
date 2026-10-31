'use strict';
// SYNTHETIC ONLY: two distinct IN-MEMORY authorities. Neither is a
// provider-backed, durable witness, and neither can authorize a real B2 PUT.
const crypto=require('node:crypto');
const ZERO='0'.repeat(64);
const HASH=/^[a-f0-9]{64}$/;
const ID=/^[a-zA-Z0-9_-]{1,80}$/;
function fail(reason){const e=Error('GDPR_MODEL_ANCHOR_'+reason);e.code=e.message;throw e;}
const hash=v=>crypto.createHash('sha256').update(JSON.stringify(v)).digest('hex');
const copy=v=>structuredClone(v);
const checkpointBody=s=>({count:s.count,head:s.head});
class SyntheticMonotonicAnchor {
  #checkpoint={count:0,head:ZERO};
  #secret='synthetic-anchor-key-not-provider-backed';
  available=true;
  #mac(s){return crypto.createHmac('sha256',this.#secret)
    .update(JSON.stringify(checkpointBody(s))).digest('hex');}
  current(){
    if(!this.available)fail('UNAVAILABLE');
    return {...this.#checkpoint,mac:this.#mac(this.#checkpoint)};
  }
  verify(checkpoint){
    if(!this.available)fail('UNAVAILABLE');
    const real=this.current();
    if(!checkpoint || typeof checkpoint!=='object' || Array.isArray(checkpoint) ||
      Object.keys(checkpoint).sort().join(',')!=='count,head,mac' ||
      !Number.isSafeInteger(checkpoint.count) || !HASH.test(checkpoint.head||'') ||
      !HASH.test(checkpoint.mac||'') ||
      JSON.stringify(checkpoint)!==JSON.stringify(real))fail('STALE_OR_FORGED');
    return copy(real);
  }
  commit(previous,entry){
    this.verify(previous);
    if(!entry || !Number.isSafeInteger(entry.seq) ||
      entry.seq!==this.#checkpoint.count+1 ||
      entry.prev!==this.#checkpoint.head ||
      entry.hash!==hash({seq:entry.seq,prev:entry.prev,
        key:entry.key,digest:entry.digest}) ||
      !ID.test(entry.key||'') || !HASH.test(entry.digest||''))
      fail('COMMIT_DENIED');
    this.#checkpoint={count:entry.seq,head:entry.hash};
    return this.current();
  }
}
class SyntheticReservationJournal {
  constructor(anchor,oldEntries=[]){
    this.anchor=anchor;
    this.entries=copy(oldEntries);
    this.available=true;
  }
  verify(){
    if(!this.available)fail('JOURNAL_UNAVAILABLE');
    if(!this.anchor)fail('UNAVAILABLE');
    let previous=ZERO;
    const seen=new Set();
    for(let i=0;i<this.entries.length;i++){
      const e=this.entries[i];
      if(!e||e.seq!==i+1||e.prev!==previous||
        !ID.test(e.key||'')||!HASH.test(e.digest||'')||
        seen.has(e.key)||e.hash!==hash({seq:e.seq,prev:e.prev,
          key:e.key,digest:e.digest}))fail('JOURNAL_DIVERGENCE');
      seen.add(e.key);
      previous=e.hash;
    }
    const anchored=this.anchor.current();
    if(anchored.count!==this.entries.length || anchored.head!==previous)
      fail('ROLLBACK_OR_GAP');
    return anchored;
  }
  reserve(key,digest,{crashAt}={}){
    if(!ID.test(key||'') || !HASH.test(digest||''))fail('BAD_REQUEST');
    const before=this.verify();
    const existing=this.entries.find(e=>e.key===key);
    if(existing) {
      if(existing.digest!==digest)fail('KEY_COLLISION');
      fail('REMOTE_PUT_MAY_HAVE_HAPPENED');
    }
    const record={seq:before.count+1,prev:before.head,key,digest};
    const e={...record,hash:hash(record)};
    // Simulates a journal persistence step BEFORE a separate anchor commit.
    // Failure between these steps is ambiguous and MUST remain NO-GO.
    this.entries.push(e);
    if(crashAt==='afterJournal')fail('INJECTED_CRASH_AFTER_JOURNAL');
    const receipt=this.anchor.commit(before,e);
    if(crashAt==='afterAnchor')fail('INJECTED_CRASH_AFTER_ANCHOR');
    return {receipt,permit:'SYNTHETIC_ONLY_ONE_SHOT',
      productionRecoveryReady:false};
  }
}
function attempt(f,key,digest,options={}){
  const local=f.sql.get(key);
  if(!local || local.digest!==digest || local.phase!=='UNKNOWN')
    fail('SQL_INTENT_NOT_VERIFIED');
  const permit=f.journal.reserve(key,digest,options);
  // This models the decision to allow ONE fake call only after BOTH markers.
  f.fakePuts.push({key,digest});
  return permit;
}
module.exports={ZERO,hash,SyntheticMonotonicAnchor,
  SyntheticReservationJournal,attempt};
