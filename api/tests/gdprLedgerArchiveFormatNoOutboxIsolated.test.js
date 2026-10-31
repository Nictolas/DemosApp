'use strict';
// CI-safe, source-level regression: no SQL, B2, credentials or production I/O.
const test = require('node:test');
const assert = require('node:assert/strict');
const Ledger = require('../services/privacyErasureLedgerService');

const EVENT = Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED;
function forbiddenDb() {
  let queries = 0;
  return {
    get queries() { return queries; },
    async query() {
      queries++;
      throw Error('SYNTHETIC_SQL_REACHED');
    }
  };
}
async function inOutboxMode(mode, fn) {
  const original = process.env.GDPR_ERASURE_OUTBOX_ENABLED;
  try {
    process.env.GDPR_ERASURE_OUTBOX_ENABLED = mode;
    await fn();
  } finally {
    if (original === undefined) delete process.env.GDPR_ERASURE_OUTBOX_ENABLED;
    else process.env.GDPR_ERASURE_OUTBOX_ENABLED = original;
  }
}
test('SQL-only ledger cannot persist events exceeding the bounded B2 archive limit', async () => {
  for (const mode of ['false', 'true']) {
    await inOutboxMode(mode, async () => {
      const db = forbiddenDb();
      await assert.rejects(Ledger.recordEvent(db, {
        userId:'00000000-0000-4000-8000-000000000301',
        eventType:EVENT,
        details:{syntheticOnly:true, oversized:'x'.repeat(9000)}
      }), /GDPR ledger event exceeds minimization limit/);
      assert.equal(db.queries, 0, 'reject unarchivable event before SQL in mode ' + mode);
    });
  }
});

test('invalid archive subject identifiers fail before SQL with outbox disabled or enabled', async () => {
  for (const mode of ['false', 'true']) {
    await inOutboxMode(mode, async () => {
      const db = forbiddenDb();
      await assert.rejects(Ledger.recordEvent(db, {
        userId:'s'.repeat(129), eventType:EVENT, details:{syntheticOnly:true}
      }), /Invalid GDPR ledger event/);
      assert.equal(db.queries, 0);
    });
  }
});

test('valid bounded event passes archive preflight without contacting B2', async () => {
  for (const mode of ['false', 'true']) {
    await inOutboxMode(mode, async () => {
      const db = forbiddenDb();
      // The first SQL preflight is deliberately blocked in this test.
      // Passing it proves archive normalization accepted the event; it
      // does not grant permission to write to B2 or a live database.
      await assert.rejects(Ledger.recordEvent(db, {
        userId:'00000000-0000-4000-8000-000000000301',
        eventType:EVENT, details:{syntheticOnly:true}
      }), /SYNTHETIC_SQL_REACHED/);
      assert.equal(db.queries, 1);
    });
  }
});

test('SQL microsecond precision cannot turn a preflight-approved 8192-byte event into an unarchivable event', async () => {
  // Exact synthetic boundary: a millisecond timestamp is 3 bytes shorter
  // than the six-digit microsecond timestamp returned by PostgreSQL.
  const { normalizeEvent } = require('../services/privacyErasureB2Journal');
  const subject = '00000000-0000-4000-8000-000000000301';
  const details = { syntheticOnly:true, padding:'x'.repeat(7952) };
  const event = {
    event_key:subject, subject_user_id:subject, event_type:EVENT,
    occurred_at:'2000-01-01T00:00:00.000001Z', details
  };
  assert.equal(Buffer.byteLength(JSON.stringify(normalizeEvent(event))), 8192);
  assert.equal(Buffer.byteLength(JSON.stringify(normalizeEvent({
    ...event, occurred_at:'2000-01-01T00:00:00.000Z'
  }))), 8189);
  for (const mode of ['false','true']) {
    await inOutboxMode(mode, async () => {
      const db=forbiddenDb();
      await assert.rejects(Ledger.recordEvent(db, {
        userId:subject,eventType:EVENT,details:{...details,padding:details.padding+'x'}
      }), /GDPR ledger event exceeds minimization limit/);
      assert.equal(db.queries,0);
    });
  }
});
