const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {
  canRequestEvent,
  canCreateElectionEvent,
  initialApprovalState,
  hasSubstantialEventChange
} = require('../services/eventApprovalService');

const migration = fs.readFileSync(path.join(__dirname, '..', 'database', 'create-event-approval-model.sql'), 'utf8');

test('event creation capabilities match DEMOS product roles', () => {
  assert.equal(canRequestEvent({ isAdmin: true }), true);
  assert.equal(canRequestEvent({ accountType: 'INSTITUTION' }), true);
  assert.equal(canRequestEvent({ accountType: 'ORGANIZATION' }), true);
  assert.equal(canRequestEvent({ accountType: 'PERSON', isPolitician: true }), true);
  assert.equal(canRequestEvent({ accountType: 'PERSON', isCandidate: true }), true);
  assert.equal(canRequestEvent({ accountType: 'PERSON', isActivist: true }), true);
  assert.equal(canRequestEvent({ accountType: 'PERSON' }), false);
});

test('only admin/staff can create canonical election events', () => {
  assert.equal(canCreateElectionEvent({ isAdmin: true }), true);
  assert.equal(canCreateElectionEvent({ isPolitician: true }), false);
});

test('non-admin events start pending while admin events can be immediately approved', () => {
  assert.deepEqual(initialApprovalState({ isAdmin: false }), { status: 'PENDING', approvedNow: false });
  assert.deepEqual(initialApprovalState({ isAdmin: true }), { status: 'APPROVED', approvedNow: true });
});

test('substantial event changes require reapproval', () => {
  const original = { nome_evento: 'Evento', giorno_inizio: '2027-01-01', comune_evento: 'Pisa' };
  assert.equal(hasSubstantialEventChange(original, { ...original }), false);
  assert.equal(hasSubstantialEventChange(original, { ...original, giorno_inizio: '2027-01-02' }), true);
  assert.equal(hasSubstantialEventChange(original, { ...original, comune_evento: 'Lucca' }), true);
});

test('approval migration preserves existing events as approved and defaults new rows to pending', () => {
  assert.match(migration, /UPDATE eventi[\s\S]*approval_status = 'APPROVED'/i);
  assert.match(migration, /ALTER COLUMN approval_status SET DEFAULT 'PENDING'/i);
  assert.match(migration, /CHECK \(approval_status IN \('PENDING', 'APPROVED', 'REJECTED'\)\)/i);
  assert.match(migration, /creator_user_id UUID/i);
});
