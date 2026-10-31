'use strict';

// SYNTHETIC ONLY. Models an independent, durable receipt ledger for B2 version
// IDs. This HMAC key and all pins exist only in memory; NO real B2 attestation.
const crypto = require('node:crypto');
const {verifySyntheticB2VersionInventory,keyFor} =
  require('./gdprB2VersionInventorySynthetic');
const BAD = 'GDPR_MODEL_B2_PIN_UNVERIFIED';
const fail = () => { const error = new Error(BAD); error.code = BAD; throw error; };
const digest = value => crypto.createHmac('sha256', 'synthetic-version-pins-test-only')
  .update(JSON.stringify(value)).digest('hex');
const validId = value => typeof value === 'string' &&
  /^[A-Za-z0-9._~+=-]{1,256}$/.test(value);
const validHash = value => typeof value === 'string' &&
  /^[a-f0-9]{64}$/.test(value);
const same = (a,b) => JSON.stringify(a) === JSON.stringify(b);
const pinFields = 'ContentLength,Key,Sha256,VersionId';

class SyntheticIndependentVersionPins {
  #epoch;
  #pins = [];
  #sealed = null;
  #lost = false;
  available = true;

  constructor(epoch) {
    if (typeof epoch !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(epoch))
      fail();
    this.#epoch = epoch;
  }

  // Called only AFTER a simulated provider acknowledgement. A real provider
  // version ID cannot be guessed or reconstructed from the journal.
  acknowledge(raw) {
    if (!this.available || this.#lost || this.#sealed) fail();
    if (!raw || Array.isArray(raw) || typeof raw !== 'object' ||
        Object.keys(raw).sort().join(',') !== pinFields ||
        this.#pins.length >= 512 ||
        raw.Key !== keyFor(this.#epoch,this.#pins.length+1) ||
        !validId(raw.VersionId) ||
        !Number.isSafeInteger(raw.ContentLength) ||
        raw.ContentLength < 1 || raw.ContentLength > 4096 ||
        !validHash(raw.Sha256) ||
        this.#pins.some(x => x.VersionId === raw.VersionId)) fail();
    this.#pins.push({...raw});
    return this.#pins.length;
  }

  seal(journal,checkpoint) {
    if (!this.available || this.#lost || this.#sealed) fail();
    if (!journal || journal.epoch !== this.#epoch || !checkpoint) fail();
    // A local assertion cannot substitute for an external checkpoint.
    journal.witness.verify(checkpoint);
    journal.verify();
    if (!checkpoint.sealed || checkpoint.count !== this.#pins.length ||
        checkpoint.head !== journal.state().head) fail();
    const body = {epoch:this.#epoch,count:checkpoint.count,
      head:checkpoint.head,pins:this.#pins.map(x=>({...x}))};
    this.#sealed = {...body,mac:digest(body)};
    return structuredClone(this.#sealed);
  }

  current() { return this.#sealed && structuredClone(this.#sealed); }
  lose() { this.#lost=true; this.#pins=[]; this.#sealed=null; }

  verify(journal,checkpoint,receipt) {
    if (!this.available || this.#lost || !this.#sealed ||
        !receipt || typeof receipt !== 'object' || Array.isArray(receipt))
      fail();
    if (!journal || journal.epoch !== this.#epoch || !checkpoint) fail();
    journal.witness.verify(checkpoint);
    journal.verify();
    if (!checkpoint.sealed || checkpoint.count !== this.#sealed.count ||
        checkpoint.head !== this.#sealed.head ||
        !same(receipt,this.#sealed)) fail();
    const body={epoch:receipt.epoch,count:receipt.count,
      head:receipt.head,pins:receipt.pins};
    if (!validHash(receipt.mac) || digest(body) !== receipt.mac) fail();
    return this.#pins.map(x=>({...x}));
  }
}

function verifySyntheticPinnedB2Inventory(journal,checkpoint,pages,authority,receipt) {
  if (!authority || typeof authority.verify !== 'function') fail();
  // Pin source must already have been sealed independently; do not generate
  // receipts from the inventory being checked (circular verification).
  const pins=authority.verify(journal,checkpoint,receipt);
  const result=verifySyntheticB2VersionInventory(journal,checkpoint,pages);
  const listed=pages.flatMap(page=>page.objects);
  if (pins.length !== listed.length) fail();
  for (let i=0;i<pins.length;i++) {
    const actual=listed[i];
    const pinned=pins[i];
    if (!same({
      Key:actual.Key,VersionId:actual.VersionId,
      ContentLength:actual.ContentLength,Sha256:actual.Sha256
    },pinned)) fail();
  }
  return Object.freeze({
    ...result,syntheticIndependentVersionPinsVerified:true,
    // Neither the inventory nor the in-memory signer proves real completeness.
    completeGdprJournalVerified:false,productionRecoveryReady:false,
    externalProviderAttested:false,isolatedRestoreVerified:false
  });
}

module.exports={BAD,SyntheticIndependentVersionPins,
  verifySyntheticPinnedB2Inventory};
