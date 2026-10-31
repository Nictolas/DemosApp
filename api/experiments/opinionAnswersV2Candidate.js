'use strict';

/**
 * Research-only candidate for DEMOS opinion answer storage v2.
 * NOT IMPORTED by runtime routes and NOT ENABLED in production.
 *
 * One JSONB document per user is keyed by immutable, published opinion IDs:
 *   { "energia_nucleare": "f", "another_id": "c" }
 * No catalog entry is fetched from SQL and new IDs need no answer-table DDL.
 *
 * SAFETY: callers must lock public.users FOR UPDATE inside a transaction,
 * then re-read Art. 9 consent AFTER acquiring that lock, BEFORE any write.
 * This helper does not replace that privacy protocol.
 */
const ANSWERS = new Set(['f', 'c', 'i']);
const ID_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;
const MAX_DELTA_KEYS = 512;

function isPlainRecord(value) {
  return value !== null && typeof value === 'object' &&
    (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null);
}

function sanitizePublishedDelta(input, publishedIds) {
  if (!(publishedIds instanceof Set)) throw new TypeError('publishedIds must be a Set');
  if (!isPlainRecord(input)) throw new TypeError('Expected an opinion answer object');
  const entries = Object.entries(input);
  if (entries.length === 0 || entries.length > MAX_DELTA_KEYS) {
    throw new RangeError('Invalid number of opinion answers');
  }

  const delta = Object.create(null);
  for (const [id, value] of entries) {
    if (!ID_PATTERN.test(id) || !publishedIds.has(id)) {
      throw new RangeError('Unknown or unpublished opinion ID');
    }
    if (!ANSWERS.has(value)) {
      throw new TypeError('Invalid opinion answer: expected f, c or i');
    }
    delta[id] = value;
  }
  return delta;
}

function sanitizeStoredDocument(stored) {
  if (stored === null || stored === undefined) return Object.create(null);
  if (!isPlainRecord(stored)) throw new TypeError('Stored answers must be an object');
  const answers = Object.create(null);
  for (const [id, value] of Object.entries(stored)) {
    // Historical, unpublished IDs remain valid for GDPR export and rollback.
    // They must never be recycled, but need not exist in today's catalog.
    if (!ID_PATTERN.test(id) || !ANSWERS.has(value)) {
      throw new TypeError('Malformed stored opinion document');
    }
    answers[id] = value;
  }
  return answers;
}

function planAnswerDelta(stored, rawDelta, publishedIds) {
  const current = sanitizeStoredDocument(stored);
  const requested = sanitizePublishedDelta(rawDelta, publishedIds);
  const changed = Object.create(null);
  const notifications = [];
  const firstAnswers = [];

  for (const [id, next] of Object.entries(requested)) {
    const before = current[id] ?? null;
    if (before === next) continue;
    changed[id] = next;
    if (before === null) {
      firstAnswers.push(id);
    } else {
      // A real change to an existing answer; never notify on first answers.
      notifications.push({ opinionId: id, previousValue: before, newValue: next });
    }
  }

  return {
    acceptedCount: Object.keys(requested).length,
    changedCount: Object.keys(changed).length,
    changed,
    notifications,
    firstAnswers,
    // Preview only; SQL must apply the JSONB patch atomically, not overwrite
    // the entire document built from a potentially stale client snapshot.
    merged: Object.assign(Object.create(null), current, changed)
  };
}

// Static parameterized SQL; never interpolate IDs or answer values into SQL.
// Execute only after user row lock + consent recheck in the SAME transaction.
// An unchanged patch should skip upsert entirely (zero useless UPDATE/WAL).
const SQL = Object.freeze({
  readForUpdate: 'SELECT answers FROM demos_private.opinion_answer_maps_v2 WHERE user_id = $1 FOR UPDATE',
  upsertPatch: `INSERT INTO demos_private.opinion_answer_maps_v2 AS existing (user_id, answers)
VALUES ($1::uuid, $2::jsonb)
ON CONFLICT (user_id) DO UPDATE SET
  answers = existing.answers || EXCLUDED.answers,
  updated_at = now()`,
  // This is explicitly NOT a migration. Restrict new writes until backend
  // role, RLS, GDPR erase/restore, statistics, Android and rollback are tested.
  payload: (changed) => JSON.stringify(changed)
});

module.exports = {
  sanitizePublishedDelta, sanitizeStoredDocument, planAnswerDelta, SQL
};
