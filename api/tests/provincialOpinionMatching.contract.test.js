'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolvePoliticalOffice,
  getOpinionGradeForOffice,
  getMatchingOpinionGradeForOffice,
  resolveOpinionScope,
} = require('../services/politicalJurisdictionRegistryService');
const { getOpinionIdsForGrade } = require('../services/opinionCatalog');
const { buildPoliticalMatches } = require('../services/politicalMatchingService');

const PROVINCIAL_OFFICES = ['it.provincial.trento', 'it.provincial.bolzano'];

function mockAnswerPool(rows) {
  const calls = [];
  return {
    calls,
    async query(sql, params) {
      calls.push({ sql: String(sql), params });
      assert.match(String(sql), /FROM opinioni_risposte r/);
      assert.match(String(sql), /JOIN users u ON u\.id = r\.user_id/);
      assert.match(String(sql), /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
      assert.match(String(sql), /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
      assert.doesNotMatch(String(sql), /SELECT\s+(?:r\.)?\*/i, 'never read all political answers or source JSON');
      const ids = new Set((params?.[0] || []).map(String));
      return { rows: rows.filter((row) => ids.has(String(row.user_id))) };
    },
  };
}

test('both autonomous councils reuse the six published C IDs without a universal provincial filter', () => {
  const provincialIds = getOpinionIdsForGrade('C');
  const municipalIds = new Set(getOpinionIdsForGrade('CO'));
  const regionalIds = new Set(getOpinionIdsForGrade('R'));

  assert.equal(provincialIds.length, 6);
  assert.equal(new Set(provincialIds).size, provincialIds.length, 'no duplicate opinion IDs');
  assert.ok(provincialIds.every((id) => municipalIds.has(id)), 'C shares existing CO answers');
  assert.ok(provincialIds.some((id) => regionalIds.has(id)), 'some C questions also appear in R');

  for (const id of PROVINCIAL_OFFICES) {
    assert.ok(resolvePoliticalOffice(id));
    assert.equal(getMatchingOpinionGradeForOffice(id), 'C');
    assert.equal(getOpinionGradeForOffice(id), null, 'do not approve a new universal scope');
  }
  assert.equal(resolveOpinionScope('C'), null, 'no new opinion menu/filter is introduced');
  assert.equal(resolvePoliticalOffice('PROVINCIALE'), null, 'ordinary provinces remain excluded');
});

test('matching counts each C opinion once, including those shared with R and CO', async () => {
  const ids = getOpinionIdsForGrade('C');
  const answered = Object.fromEntries(ids.map((id) => [id, 'f']));
  const pool = mockAnswerPool([
    { user_id: 'resident', ...answered },
    { user_id: 'councillor', ...answered },
  ]);
  for (const officeId of PROVINCIAL_OFFICES) {
    const result = await buildPoliticalMatches({
      pool, userId: 'resident', subjects: [{ id: 'councillor', cognome: 'Test' }],
      grade: getMatchingOpinionGradeForOffice(officeId),
    });
    assert.equal(result.isComplete, true);
    assert.equal(result.totalOpinions, ids.length);
    assert.deepEqual(result.opinionIds, ids);
    assert.equal(result.matches.length, 1);
    assert.equal(result.matches[0].copertura_totale, ids.length);
    assert.equal(result.matches[0].copertura_posizioni, ids.length);
    assert.equal(result.matches[0].matching_score, 3 * ids.length);
  }
  assert.equal(pool.calls.length, PROVINCIAL_OFFICES.length, 'one answer query per matching run');
  assert.ok(pool.calls.every((call) => !call.sql.includes('opinioni_domande')));
});

test('provincial matching fails closed on a missing answer rather than duplicating another level', async () => {
  const ids = getOpinionIdsForGrade('C');
  const answered = Object.fromEntries(ids.map((id) => [id, 'f']));
  delete answered[ids[0]];
  const pool = mockAnswerPool([
    { user_id: 'resident', ...answered },
    { user_id: 'councillor', ...Object.fromEntries(ids.map((id) => [id, 'f'])) },
  ]);
  const result = await buildPoliticalMatches({
    pool, userId: 'resident', subjects: [{ id: 'councillor' }], grade: 'C',
  });
  assert.equal(result.isComplete, false);
  assert.equal(result.missingOpinions, 1);
  assert.deepEqual(result.matches, []);
});
