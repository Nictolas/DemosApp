'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { getOpinionIdsForGrade } = require('../services/opinionCatalog');

const root = path.resolve(__dirname, '../..');
const topicRef = path.join(root, '.integration-refs', 'opinion-topics');
const consentRef = path.join(root, '.integration-refs', 'political-consent');
const read = (file) => fs.readFileSync(file, 'utf8');

function getAnswerQuery(profile) {
  const start = profile.indexOf("router.get('/:userId/opinioni'");
  const end = profile.indexOf('// PUT /api/users/:userId/opinioni', start);
  assert.ok(start >= 0 && end > start, 'personal opinion read route must exist');
  const endpoint = profile.slice(start, end);
  assert.match(endpoint, /Cache-Control', 'private, no-store, max-age=0'/);
  assert.match(endpoint, /verifyToken, userDataAuditMiddleware/);
  assert.match(endpoint, /getAccountSubject\(pool, userId\)/);
  assert.match(endpoint, /const canReadOpinions\s*=/);
  // Check the complete single-statement answer/source read, excluding other
  // profile endpoints and their SQL.
  const delimiter = String.fromCharCode(96);
  const queryPattern = new RegExp(delimiter + 'SELECT r\\.\\*[\\s\\S]*?' + delimiter + ',\\s*\\[userId\\]');
  const match = endpoint.match(queryPattern);
  assert.ok(match, 'answer and source JSON must be gated in a single SELECT');
  const sql = match[0].replace(/\s+/g, ' ').trim();
  assert.match(sql, /JOIN users u ON u\.id = r\.user_id/);
  assert.match(sql, /LEFT JOIN user_consents uc ON uc\.user_id = u\.id/);
  assert.match(sql, /COALESCE\(uc\.political_opinions_consent, u\.political_opinions_consent, false\) IS TRUE/);
  return sql;
}

test('PR #624 provincial opinion IDs match the six actual C IDs in PR #627 exactly', () => {
  const source = read(path.join(topicRef, 'client/src/lib/opinionProvincialIds.ts'));
  const match = source.match(/OPINION_PROVINCIAL_IDS[^=]*=\s*new Set\(\[([\s\S]*?)\]\)/);
  assert.ok(match, 'the thematic branch must export the published C ID set');
  const ids = [...match[1].matchAll(/"([a-z0-9_]+)"/g)].map((entry) => entry[1]);
  assert.equal(ids.length, 6);
  assert.equal(new Set(ids).size, ids.length);
  assert.deepEqual([...ids].sort(), [...getOpinionIdsForGrade('C')].sort());

  const topics = read(path.join(topicRef, 'client/src/lib/opinionTopics.ts'));
  const mapping = topics.match(/OPINION_TOPIC_BY_ID[^=]*=\s*Object\.freeze\(\{([\s\S]*?)\}\)/);
  assert.ok(mapping, 'the proposed thematic mapping must exist');
  const mappedIds = [...mapping[1].matchAll(/"([a-z0-9_]+)"\s*:\s*"[a-z0-9_]+"/g)]
    .map((entry) => entry[1]);
  assert.equal(new Set(mappedIds).size, mappedIds.length, 'each public ID maps to one topic');
  assert.equal(mappedIds.length, 94, 'thematic branch still covers the 94 published opinion IDs');
  for (const id of ids) assert.ok(mappedIds.includes(id), 'C opinion must retain its thematic mapping');
});

test('PR #557 political matching consent implementation is identical to PR #627', () => {
  const pathInApi = 'api/services/politicalMatchingService.js';
  assert.equal(
    read(path.join(root, pathInApi)),
    read(path.join(consentRef, pathInApi)),
    'a consent/matching divergence requires integration review before release',
  );
});

test('PR #557 current-consent opinion/source read is preserved by PR #627', () => {
  const relative = 'api/routes/users/profile.js';
  const local = read(path.join(root, relative));
  const reference = read(path.join(consentRef, relative));
  assert.equal(getAnswerQuery(local), getAnswerQuery(reference));
  // Additional provincial endpoints remain self-scoped and refuse pre-GO
  // disclosure, rather than becoming unrestricted read paths.
  assert.match(local, /router\.get\('\/:userId\/provincial-selection'/);
  assert.match(local, /String\(req\.userId\) !== String\(userId\)/);
  assert.match(local, /PROVINCIAL_SELECTION_NOT_RELEASED/);
});
