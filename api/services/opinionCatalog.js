'use strict';

// The official published catalog lives in this release, not in a DB table.
// Only PUBLIC opinion metadata is included. Personal answers, draft proposals
// and GDPR consent must still be loaded from PostgreSQL per authorized user.
const parts = [0, 1, 2, 3, 4, 5].map(i => require(`../catalog/opinions-part-0${i}.json`));
const opinions = Object.freeze(parts.flat().map((op) => Object.freeze({
  id: op.id, text: op.text, approfondimento: op.approfondimento,
  gradi_opinione: Object.freeze([...op.gradi_opinione])
})));
const byId = new Map(opinions.map(op => [op.id, op]));
if (opinions.length !== 94 || byId.size !== opinions.length) {
  throw new Error('Invalid versioned opinion catalog: 94 distinct IDs expected');
}
function getAllOpinions() { return opinions; }
function getOpinionById(id) { return byId.get(String(id)) || null; }
function isPublishedOpinionId(id) { return byId.has(String(id)); }
function getOpinionsForGrade(grade) {
  return opinions.filter(op => op.gradi_opinione.includes(String(grade)));
}
function getOpinionIdsForGrade(grade) {
  return getOpinionsForGrade(grade).map(op => op.id).sort();
}
function sortOpinionsByText(items) {
  return [...items].sort((a, b) => a.text.localeCompare(b.text, 'it'));
}
function findOpinionIdByText(input) {
  const text = String(input || '').replace(/_/g, ' ').trim().toLocaleLowerCase('it');
  if (!text) return null;
  const id = String(input);
  if (byId.has(id)) return id;
  const direct = opinions.find(op => op.text.toLocaleLowerCase('it') === text);
  if (direct) return direct.id;
  // Compatibility fallback used by old Android clients that sent text instead of ID.
  const candidates = opinions.filter(op => op.text.toLocaleLowerCase('it').includes(text));
  return candidates.length === 1 ? candidates[0].id : null;
}
module.exports = {
  getAllOpinions, getOpinionById, isPublishedOpinionId,
  getOpinionsForGrade, getOpinionIdsForGrade,
  sortOpinionsByText, findOpinionIdByText
};
