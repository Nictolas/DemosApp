'use strict';

// Fail-closed eligibility for displaying parliamentary votes as FINAL.
// An approved amendment/article/motion, or an approved confidence vote,
// is not a final vote on the bill itself. The outcome ("approved") alone
// never proves a final vote. Labels from a database without provenance
// cannot substitute for the official vote classification.
const INTERMEDIATE = /\b(?:articol[oi]|emendament[oi]|em\.?\s*\d|odg\b|ordini?\s+del\s+giorno|mozion[ei]|risoluzion[ei]|fiducia|question[ei]\s+(?:pregiudizial[ei]|sospensiv[ei])|coordinamento\s+formale|votazione\s+procedurale|voto\s+procedurale|comma|capovers[oi]|parti?\s+dispositiv[ae])\b/i;
const FINAL = /\b(?:votazione\s+finale|voto\s+finale|votazione\s+definitiva|voto\s+definitivo|approvazione\s+definitiva|approvato\s+definitivamente|votazione\s+conclusiva|voto\s+conclusivo)\b/i;

function isConfirmedFinalParliamentVote(data) {
  if (!data || typeof data !== 'object') return false;
  const title = String(data.titolo_votazione || data.votazione || data.titolo || '').trim();
  const classification = String(data.tipo_votazione || data.fase_votazione || '').trim();
  if (!title || INTERMEDIATE.test(title) || INTERMEDIATE.test(classification)) return false;
  // A plain law title, a vote outcome or a generic "approved" are not
  // sufficient. Only explicit final-vote terminology is admitted.
  return FINAL.test(title) || FINAL.test(classification);
}

module.exports = { isConfirmedFinalParliamentVote };
