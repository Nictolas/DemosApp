'use strict';

/**
 * Extract an explicitly labelled parliamentary bill identifier only.
 * Do not treat an arbitrary year, decree, motion, amendment or roll-call
 * number as a Senate/Camera bill number.
 */
function estraiNumeroLegge(titolo) {
  if (typeof titolo !== 'string') return null;

  const patterns = [
    /\b(?:disegno\s+di\s+legge|proposta\s+di\s+legge|ddl|atto\s+senato|atto\s+camera)\s*(?:n(?:umero)?\.?\s*)?(\d{1,5})\b/i,
    /(?:^|[\s(])(?:S|C)\.\s*(\d{1,5})\b/i
  ];
  for (const pattern of patterns) {
    const match = titolo.match(pattern);
    if (match) return match[1];
  }
  return null;
}

function canSearchItalianBills(numeroLegge, camera) {
  return typeof numeroLegge === 'string' &&
    /^\d{1,5}$/.test(numeroLegge) &&
    (camera === 'Senato' || camera === 'Camera');
}

function canSearchActTitle(numeroLegge, titolo, camera) {
  if (!canSearchItalianBills(numeroLegge, camera) || typeof titolo !== 'string') {
    return false;
  }
  // A generic DDL number cannot override an explicit chamber reference.
  // Inspect *all* S./C. identifiers, not just the first one: otherwise
  // "DDL 123, S. 999" could silently fetch the unrelated Senate DDL 123.
  const chamberReferences = [...titolo.matchAll(/(?:^|[\s(])([SC])\.\s*(\d{1,5})\b/gi)];
  if (chamberReferences.length > 0) {
    const expectedChamber = camera === 'Senato' ? 'S' : 'C';
    const inRequestedChamber = chamberReferences.filter(
      match => match[1].toUpperCase() === expectedChamber
    );
    // A source lookup is safe only if the correct chamber explicitly
    // identifies the same numbered act, with no conflicting reference.
    return inRequestedChamber.length > 0 &&
      inRequestedChamber.every(match => match[2] === numeroLegge);
  }
  return true;
}

/**
 * Classify parliamentary acts by whole terms only. In particular "EM" must
 * never match the middle of ordinary words such as "sistema" or "tema".
 * Full names take precedence over short parliamentary abbreviations.
 */
function estraiTipoAtto(titolo) {
  if (typeof titolo !== 'string') return null;
  const labels = [
    ['Emendamento', /\bemendament[oi]\b/iu],
    ['Disegno di legge', /\bdisegno\s+di\s+legge\b/iu],
    ['Proposta di legge', /\bproposta\s+di\s+legge\b/iu],
    ['Mozione', /\bmozion[ei]\b/iu],
    ['Decreto', /\bdecreto\b/iu],
    ['ODG', /\b(?:odg|ordine\s+del\s+giorno)\b/iu],
    ['DDL', /\bddl\b/iu],
    ['EM', /\bem\b/iu],
  ];
  for (const [label, pattern] of labels) {
    if (pattern.test(titolo)) return label;
  }
  return null;
}

module.exports = { estraiNumeroLegge, canSearchItalianBills, canSearchActTitle, estraiTipoAtto };
