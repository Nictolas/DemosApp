const test = require('node:test');
const assert = require('node:assert/strict');

const {
  isPublicPoliticalRole,
  canReadUserOpinions
} = require('../utils/opinionPrivacy');

test('politici e candidati hanno opinioni consultabili', () => {
  for (const role of ['P', 'C', 'CP', 'Politico', 'Candidato', 'Candidato Politico']) {
    assert.equal(isPublicPoliticalRole(role), true);
  }
});

test('i ruoli cittadini non sono profili politici pubblici', () => {
  for (const role of ['E', 'A', 'I', '', null, undefined]) {
    assert.equal(isPublicPoliticalRole(role), false);
  }
});

test('un cittadino può leggere le proprie opinioni', () => {
  assert.equal(canReadUserOpinions({
    requesterId: 'user-1',
    requesterRole: 'E',
    targetId: 'user-1',
    targetRole: 'E'
  }), true);
});

test('un cittadino non può leggere le opinioni private di un altro cittadino', () => {
  assert.equal(canReadUserOpinions({
    requesterId: 'user-1',
    requesterRole: 'E',
    targetId: 'user-2',
    targetRole: 'E'
  }), false);
});

test('un utente autenticato può leggere le opinioni di politici e candidati', () => {
  for (const targetRole of ['P', 'C', 'CP']) {
    assert.equal(canReadUserOpinions({
      requesterId: 'user-1',
      requesterRole: 'E',
      targetId: 'public-figure',
      targetRole
    }), true);
  }
});

test('un admin può leggere le opinioni per esigenze operative', () => {
  assert.equal(canReadUserOpinions({
    requesterId: 'admin-1',
    requesterRole: 'AD',
    targetId: 'user-2',
    targetRole: 'E'
  }), true);
});
