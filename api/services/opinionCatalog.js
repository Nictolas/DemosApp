'use strict';
const { createHash } = require('node:crypto');

// The official published catalog lives in this release, not in a DB table.
// Only PUBLIC opinion metadata is included. Personal answers, draft proposals
// and GDPR consent must still be loaded from PostgreSQL per authorized user.
const parts = [0, 1, 2, 3, 4, 5].map(i => require(`../catalog/opinions-part-0${i}.json`));
const opinions = Object.freeze(parts.flat().map((op) => Object.freeze({
  id: op.id, text: op.text, approfondimento: op.approfondimento,
  gradi_opinione: Object.freeze([...op.gradi_opinione])
})));
const byId = new Map(opinions.map(op => [op.id, op]));
// Derived from public immutable metadata only: changes automatically on each
// release whenever an ID, wording, scope or explanation changes. No SQL.
const catalogRevision = createHash('sha256')
  .update(JSON.stringify(opinions))
  .digest('hex');
function getOpinionCatalogRevision() { return catalogRevision; }

const VALID_GRADES=new Set(['N','R','C','CO','E']);
if(!opinions.length || byId.size!==opinions.length || opinions.some(op=>
  !/^[a-z][a-z0-9_]{0,62}$/.test(op.id) ||
  typeof op.text!=='string' || !op.text.trim() ||
  typeof op.approfondimento!=='string' || !op.approfondimento.trim() ||
  op.gradi_opinione.length===0 || !op.gradi_opinione.every(g=>VALID_GRADES.has(g))
)){
  throw new Error('Invalid versioned opinion catalog: unique stable IDs and valid published metadata required');
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
  sortOpinionsByText, findOpinionIdByText, getOpinionCatalogRevision
};
