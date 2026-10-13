const test = require('node:test');
const assert = require('node:assert/strict');

const {
  getJurisdiction,
  getLegacyProcessType,
  resolveProcessTypeFromSource,
  getSignatureThreshold,
  resolveStageFromSource,
  getDemosActionPolicy,
  getStageRank,
  getLegacyQueryProfile,
  describeSourceRecord,
  validateRegistry,
} = require('../services/civicProcessRegistryService');

const SOURCE = 'it.justice.signature_portal';

test('registry is internally consistent and Italy is a child jurisdiction of the EU', () => {
  const validation = validateRegistry();
  assert.equal(validation.valid, true, validation.errors.join('\n'));
  assert.equal(getJurisdiction('it')?.parentId, 'eu');
  assert.equal(getJurisdiction('IT')?.code, 'IT');
});

test('legacy Italian aliases resolve to canonical civic process types', () => {
  assert.equal(getLegacyProcessType('iniziativa')?.id, 'it.popular_law_initiative');
  assert.equal(getLegacyProcessType('referendum')?.id, 'it.referendum_signature_request');
});

test('Ministero raw types are classified by the jurisdiction adapter, not by route-local rules', () => {
  const initiative = resolveProcessTypeFromSource({
    jurisdictionId: 'it',
    sourceId: SOURCE,
    rawType: 'Legge di iniziativa popolare (art. 71)',
  });
  const referendum = resolveProcessTypeFromSource({
    jurisdictionId: 'it',
    sourceId: SOURCE,
    rawType: 'Referendum abrogativo (art. 75)',
  });

  assert.equal(initiative?.family, 'popular_initiative');
  assert.equal(referendum?.family, 'referendum');
  assert.equal(resolveProcessTypeFromSource({ jurisdictionId: 'eu', sourceId: SOURCE, rawType: 'Referendum' }), null);
});

test('Italian signature thresholds live in the registry', () => {
  assert.equal(getSignatureThreshold('it.popular_law_initiative'), 50000);
  assert.equal(getSignatureThreshold('it.referendum_signature_request'), 500000);

  const initiativeQueryProfile = getLegacyQueryProfile('iniziativa');
  const referendumQueryProfile = getLegacyQueryProfile('referendum');
  assert.equal(initiativeQueryProfile.signatureThreshold, 50000);
  assert.equal(referendumQueryProfile.signatureThreshold, 500000);
  assert.deepEqual(initiativeQueryProfile.sqlLikePatterns, ['%Legge%di%iniziativa%popolare%']);
  assert.deepEqual(referendumQueryProfile.sqlLikePatterns, ['%Referendum%abrogativo%', '%Referendum%costituzionale%']);
});

test('source state maps to a canonical stage', () => {
  assert.equal(resolveStageFromSource({
    processTypeId: 'it.popular_law_initiative',
    sourceId: SOURCE,
    sourceState: 'in corso',
  }), 'signature_collection');
  assert.equal(resolveStageFromSource({
    processTypeId: 'it.popular_law_initiative',
    sourceId: SOURCE,
    sourceState: 'conclusa',
  }), 'collection_closed');
});

test('stage ordering is process-specific and parliamentary review outranks signature collection', () => {
  assert.equal(getStageRank('it.popular_law_initiative', 'signature_collection'), 10);
  assert.equal(getStageRank('it.popular_law_initiative', 'parliamentary_review'), 30);
  assert.equal(getStageRank('it.popular_law_initiative', 'closed'), 90);
  assert.equal(getStageRank('it.referendum_signature_request', 'parliamentary_review'), null);
  assert.equal(getStageRank('it.referendum_signature_request', 'ballot_scheduled'), 30);
});

test('DEMOS priority remains unavailable during signature collection and is never enabled for referenda', () => {
  assert.equal(getDemosActionPolicy('it.popular_law_initiative', 'signature_collection').demos_priority, false);
  for (const stage of ['qualified', 'collection_closed', 'parliamentary_review', 'closed', 'rejected']) {
    assert.equal(getDemosActionPolicy('it.popular_law_initiative', stage).demos_priority, true, stage);
  }

  for (const stage of ['signature_collection', 'qualified', 'collection_closed', 'ballot_scheduled', 'closed', 'rejected']) {
    assert.equal(
      getDemosActionPolicy('it.referendum_signature_request', stage).demos_priority,
      false,
      `referendum must not expose DEMOS priority in ${stage}`
    );
  }
});

test('unknown process/stage fails closed for DEMOS actions', () => {
  const policy = getDemosActionPolicy('unknown.process', 'signature_collection');
  assert.deepEqual(policy, {
    information: false,
    external_signature: false,
    demos_priority: false,
    position_on_question: false,
  });
});

test('canonical metadata can be attached additively to a legacy Ministero row', () => {
  const metadata = describeSourceRecord({
    jurisdictionId: 'it',
    sourceId: SOURCE,
    rawType: 'Legge di iniziativa popolare',
    sourceState: 'in_corso',
  });

  assert.equal(metadata.jurisdictionId, 'it');
  assert.equal(metadata.civicProcessTypeId, 'it.popular_law_initiative');
  assert.equal(metadata.sourceId, SOURCE);
  assert.equal(metadata.stageId, 'signature_collection');
  assert.equal(metadata.signatureThreshold, 50000);
  assert.equal(metadata.demosActions.external_signature, true);
  assert.equal(metadata.demosActions.demos_priority, false);
});
