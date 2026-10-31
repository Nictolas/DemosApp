'use strict';

// CI-safe recovery import preflight: synthetic inputs, no real SQL, provider,
// credentials, personal data, or recovery operation. DML is a forbidden sentinel.
const test = require('node:test');
const assert = require('node:assert/strict');
const Ledger = require('../services/privacyErasureLedgerService');
const { normalizeEvent } = require('../services/privacyErasureB2Journal');

const KEY = '00000000-0000-4000-8000-000000000931';
const USER = '00000000-0000-4000-8000-000000000932';
const TYPE = Ledger.EVENT_TYPES.POLITICAL_CONSENT_REVOKED;
const valid = (overrides = {}) => ({
  event_key: KEY, subject_user_id: USER, event_type: TYPE,
  occurred_at: '2026-10-30T12:34:56.123456Z',
  details: { synthetic: true },
  ...overrides
});
function noWriteDb() {
  const state = { catalogReads: 0, visibilityReads: 0, writes: 0 };
  const client = {
    async query(sql) {
      if (sql.includes('FROM pg_catalog.pg_class c')) {
        state.catalogReads++;
        return { rows: [{
          rls_enabled: true, force_rls: true, public_grants_exist: false,
          public_column_grants_exist: false, api_roles_with_dml_grants: 0
        }] };
      }
      if (sql.includes('row_security_active')) {
        state.visibilityReads++;
        return { rows: [{ complete_visibility: true }] };
      }
      if (sql.includes('INSERT INTO public.privacy_erasure_ledger')) {
        state.writes++;
        throw Error('SYNTHETIC_DML_BOUNDARY');
      }
      throw Error('UNEXPECTED_SQL_IN_ISOLATED_TEST');
    }
  };
  return { client, state };
}
async function rejectsBeforeDml(rows) {
  const {client,state} = noWriteDb();
  await assert.rejects(Ledger.mergeCaptured(client, rows), error => {
    assert.equal(error.code, 'GDPR_LEDGER_INVALID_CAPTURED_EVENT');
    return true;
  });
  assert.equal(state.catalogReads, 1);
  assert.equal(state.visibilityReads, 1);
  assert.equal(state.writes, 0, 'no partial import even if a later event is invalid');
}

test('oversized historic payload is rejected before recovery SQL writes', async () => {
  await rejectsBeforeDml([valid({details:{synthetic:true,padding:'x'.repeat(9000)}})]);
});
test('valid first event followed by oversized second event cannot partially import', async () => {
  await rejectsBeforeDml([
    valid(), valid({
      event_key:'00000000-0000-4000-8000-000000000933',
      details:{synthetic:true,padding:'x'.repeat(9000)}
    })
  ]);
});
test('malformed historic event key is rejected before SQL', async () => {
  await rejectsBeforeDml([valid({event_key:'legacy-key-not-a-uuid'})]);
});
test('overlong subject is rejected before SQL', async () => {
  await rejectsBeforeDml([valid({subject_user_id:'s'.repeat(129)})]);
});
test('millisecond timestamp and small JSONB payload still reach import boundary', async () => {
  const row = valid({occurred_at:'2026-10-30T12:34:56.123Z'});
  assert.ok(Buffer.byteLength(JSON.stringify(normalizeEvent(row))) < 8192);
  const {client,state} = noWriteDb();
  await assert.rejects(Ledger.mergeCaptured(client,[row]),/SYNTHETIC_DML_BOUNDARY/);
  assert.equal(state.writes,1);
});
test('lossless microsecond timestamp and small JSONB payload still reach import boundary', async () => {
  const row=valid();
  assert.equal(normalizeEvent(row).occurred_at,row.occurred_at);
  const {client,state}=noWriteDb();
  await assert.rejects(Ledger.mergeCaptured(client,[row]),/SYNTHETIC_DML_BOUNDARY/);
  assert.equal(state.writes,1);
});
test('details whose toJSON serializes to an object follow the actual JSONB archive format', async () => {
  const row=valid({details:{toJSON(){return {synthetic:true};}}});
  const {client,state}=noWriteDb();
  await assert.rejects(Ledger.mergeCaptured(client,[row]),/SYNTHETIC_DML_BOUNDARY/);
  assert.equal(state.writes,1);
});
