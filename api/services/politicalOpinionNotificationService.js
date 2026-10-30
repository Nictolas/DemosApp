const { loadSupporterUserIds } = require('./politicalSelectionService');
const { getOpinionById } = require('./opinionCatalog');

const VALID_VALUES = new Set(['f', 'c', 'i']);

function normalizeChange(change) {
  const opinionId = String(change?.opinionId || '').trim();
  const previousValue = String(change?.previousValue || '').trim();
  const newValue = String(change?.newValue || '').trim();
  if (!opinionId || !VALID_VALUES.has(previousValue) || !VALID_VALUES.has(newValue)) return null;
  if (previousValue === newValue) return null;
  return { opinionId, previousValue, newValue };
}

async function loadOpinionTexts(_db, opinionIds) {
  return new Map(opinionIds.map(id => [String(id), getOpinionById(id)?.text || String(id)]));
}

async function createSupporterOpinionNotifications(db, { subjectUserId, changes }) {
  const normalizedChanges = (changes || []).map(normalizeChange).filter(Boolean);
  if (!subjectUserId || normalizedChanges.length === 0) {
    return { created: 0, changes: 0 };
  }

  const supporters = await loadSupporterUserIds(db, { selectedUserId: subjectUserId });
  if (!supporters.userIds.length) {
    return { created: 0, changes: normalizedChanges.length };
  }

  const texts = await loadOpinionTexts(
    db,
    [...new Set(normalizedChanges.map((change) => change.opinionId))],
  );

  let created = 0;
  for (const change of normalizedChanges) {
    const opinionText = texts.get(change.opinionId) || change.opinionId;
    const result = await db.query(
      `INSERT INTO political_opinion_notifications (
         recipient_user_id,
         subject_user_id,
         opinion_id,
         opinion_text,
         previous_value,
         new_value
       )
       SELECT DISTINCT
         supporter.id,
         $1::uuid,
         $2,
         $3,
         $4,
         $5
       FROM users supporter
       WHERE supporter.id::text <> $1::text
         AND supporter.status = 'a'
         AND supporter.id::text = ANY($6::text[])
       RETURNING id`,
      [
        String(subjectUserId),
        change.opinionId,
        opinionText,
        change.previousValue,
        change.newValue,
        supporters.userIds,
      ],
    );
    created += result.rowCount || 0;
  }

  return { created, changes: normalizedChanges.length };
}

module.exports = {
  VALID_VALUES,
  normalizeChange,
  createSupporterOpinionNotifications,
};
