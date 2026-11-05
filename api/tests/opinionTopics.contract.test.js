'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { getAllOpinions } = require('../services/opinionCatalog');
const topics = require('../../client/src/lib/opinionTopics.json');

test('every official opinion has exactly one valid static topic', () => {
  const catalog = getAllOpinions();
  const ids = catalog.map((opinion) => opinion.id);
  assert.equal(ids.length, 94);
  assert.equal(new Set(ids).size, ids.length);
  assert.equal(topics.schemaVersion, 1);
  assert.equal(topics.topics.length, 11);
  const topicIds = new Set(topics.topics.map((topic) => topic.id));
  assert.equal(topicIds.size, topics.topics.length);
  for (const topic of topics.topics) {
    assert.match(topic.id, /^[a-z0-9-]+$/);
    assert.ok(topic.label && topic.description && topic.icon);
  }
  const keys = Object.keys(topics.opinionIdToTopic);
  assert.deepEqual(keys.sort(), ids.sort(), 'missing, extra or duplicate opinion ID');
  for (const id of keys) {
    assert.ok(topicIds.has(topics.opinionIdToTopic[id]), 'invalid topic for ' + id);
  }
});

test('topic metadata does not copy geography, votes or personal information', () => {
  const raw = JSON.stringify(topics);
  assert.doesNotMatch(raw, /"(gradi_opinione|risposte|user_id|email|consenso|political_opinions_consent)"\s*:/i);
  assert.equal(Object.keys(topics).sort().join(','), 'opinionIdToTopic,schemaVersion,topics');
  for (const opinion of getAllOpinions()) {
    assert.ok(Array.isArray(opinion.gradi_opinione));
    assert.ok(opinion.gradi_opinione.length > 0);
    assert.ok(topics.opinionIdToTopic[opinion.id]);
  }
});

test('topic buckets partition the catalog and cannot duplicate multi-scope opinions', () => {
  const catalog = getAllOpinions();
  const multiScope = catalog.filter((op) => op.gradi_opinione.length > 1);
  assert.ok(multiScope.length > 0, 'must cover multi-level catalog examples');
  const counts = new Map(topics.topics.map((topic) => [topic.id, 0]));
  for (const opinion of catalog) {
    const topic = topics.opinionIdToTopic[opinion.id];
    counts.set(topic, counts.get(topic) + 1);
  }
  assert.equal([...counts.values()].reduce((a, b) => a + b, 0), 94);
  assert.ok([...counts.values()].every((count) => count > 0));
});
