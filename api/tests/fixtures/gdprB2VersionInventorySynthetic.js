'use strict';

// Pure, bounded, synthetic-only B2 version inventory model.
// No SDK, network, credentials, SQL, production journal or recovery GO.
const crypto = require('node:crypto');
const BAD = 'GDPR_MODEL_B2_INVENTORY_UNVERIFIED';
const MAX_ENTRIES = 512;
const MAX_PAGES = 64;
const MAX_PAGE_ITEMS = 100;
const MAX_BODY_BYTES = 4096;
const fail = () => { const error = new Error(BAD); error.code = BAD; throw error; };
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const keyFor = (epoch, seq) =>
  'demos/gdpr-erasure/v1/events/' + epoch + '/' +
  String(seq).padStart(8, '0') + '.json';

// Caller-supplied pages are a simulated COMPLETE version inventory.
// A real ListObjectVersions API response is not an independent proof that
// every historical version was returned or that the provider is immutable.
function verifySyntheticB2VersionInventory(journal, independentCheckpoint, pages) {
  if (!journal || !journal.sealed || !journal.witness ||
      !Array.isArray(journal.entries) ||
      journal.entries.length > MAX_ENTRIES) fail();
  // The independent witness is a separate in-memory HMAC fixture; never
  // mistake it for an actual B2/Object Lock or durable external attestation.
  journal.witness.verify(independentCheckpoint);
  journal.verify(); // seal, hash chain, idempotency and no pending intents
  if (!Array.isArray(pages) || pages.length < 1 ||
      pages.length > MAX_PAGES) fail();
  let expectedCursor = null;
  let count = 0;
  const cursors = new Set();
  const versions = new Set();
  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    if (!page || Array.isArray(page) || typeof page !== 'object' ||
        Object.keys(page).sort().join(',') !== 'cursor,nextCursor,objects' ||
        page.cursor !== expectedCursor ||
        !Array.isArray(page.objects) ||
        page.objects.length > MAX_PAGE_ITEMS ||
        (page.nextCursor !== null && page.objects.length === 0)) fail();
    if (page.nextCursor !== null &&
        (typeof page.nextCursor !== 'string' ||
         !/^[a-zA-Z0-9_-]{1,80}$/.test(page.nextCursor) ||
         cursors.has(page.nextCursor))) fail();
    if ((i === pages.length - 1) !== (page.nextCursor === null)) fail();
    if (page.cursor !== null) {
      if (cursors.has('seen:' + page.cursor)) fail();
      cursors.add('seen:' + page.cursor);
    }
    for (const object of page.objects) {
      if (!object || Array.isArray(object) || typeof object !== 'object' ||
          Object.keys(object).sort().join(',') !==
            'Body,ContentLength,DeleteMarker,IsLatest,Key,Sha256,VersionId' ||
          !Buffer.isBuffer(object.Body) ||
          object.Body.length > MAX_BODY_BYTES ||
          object.DeleteMarker !== false || object.IsLatest !== true ||
          typeof object.VersionId !== 'string' ||
          !/^[A-Za-z0-9._~+=-]{1,256}$/.test(object.VersionId) ||
          versions.has(object.VersionId)) fail();
      versions.add(object.VersionId);
      const entry = journal.entries[count];
      if (!entry) fail();
      const expectedBytes = Buffer.from(JSON.stringify(entry));
      if (expectedBytes.length > MAX_BODY_BYTES ||
          object.Key !== keyFor(journal.epoch, count + 1) ||
          object.ContentLength !== expectedBytes.length ||
          object.Sha256 !== hash(expectedBytes) ||
          !object.Body.equals(expectedBytes)) fail();
      count++;
    }
    expectedCursor = page.nextCursor;
  }
  if (expectedCursor !== null || count !== journal.entries.length) fail();
  return Object.freeze({
    syntheticInventoryVerified: true,
    inspectedVersions: count,
    productionRecoveryReady: false,
    completeGdprJournalVerified: false,
    externalProviderAttested: false,
    isolatedRestoreVerified: false
  });
}

module.exports = {BAD, keyFor, verifySyntheticB2VersionInventory};
