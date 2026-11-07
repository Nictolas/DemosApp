'use strict';

/**
 * Extract an explicitly labelled parliamentary bill identifier only.
 * Do not treat an arbitrary year, decree, motion, amendment or roll-call
 * number as a Senate/Camera bill number.
 */
function estraiNumeroLegge(titolo) {
  if (typeof titolo !== 'string') return null;

  const patterns = [
    /\b(?:disegno\s+di\s+legge|proposta\s+di\s+legge|ddl|atto\s+senato|atto\s+camera)\s*(?:n(?:umero)?\.?\s*)?(\d{1,5})\b/gi,
    /(?:^|[\s(])(?:S|C)\.\s*(\d{1,5})\b/gi
  ];
  // Titles can mention multiple unrelated numbered acts, for example
  // "DDL 123 e DDL 456". Picking the first match would associate the
  // parliamentary explanation with an arbitrary official document.
  // Multiple references to the *same* number remain unambiguous.
  const ids = new Set();
  for (const pattern of patterns) {
    for (const match of titolo.matchAll(pattern)) ids.add(match[1]);
  }
  return ids.size === 1 ? [...ids][0] : null;
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
  // A caller-provided number must also agree with every explicitly labelled
  // generic bill number in the title. Without this check, "DDL 456" could
  // authorize a lookup for DDL 123 when no S./C. label was present.
  const genericReferences = [...titolo.matchAll(
    /\b(?:disegno\s+di\s+legge|proposta\s+di\s+legge|ddl)\s*(?:n(?:umero)?\.?\s*)?(\d{1,5})\b/gi
  )].map(match => match[1]);
  if (genericReferences.some(number => number !== numeroLegge)) return false;
  // A generic DDL number cannot override an explicit chamber reference.
  // Inspect *all* S./C. identifiers, not just the first one: otherwise
  // "DDL 123, S. 999" could silently fetch the unrelated Senate DDL 123.
  // Both abbreviated references (S. 123 / C. 123) and spelled-out
  // identifiers (Atto Senato n. 123 / Atto Camera n. 123) identify a chamber.
  // Check every reference; a generic DDL number must not override a mismatch.
  const chamberReferences = [...titolo.matchAll(
    /(?:^|[\s(])(?:(S|C)\.\s*|atto\s+(senato|camera)\s*(?:n(?:umero)?\.?\s*)?)(\d{1,5})\b/gi
  )].map(match => ({
    chamber: match[1]
      ? match[1].toUpperCase()
      : match[2].toLowerCase() === 'senato' ? 'S' : 'C',
    number: match[3]
  }));
  if (chamberReferences.length > 0) {
    const expectedChamber = camera === 'Senato' ? 'S' : 'C';
    const inRequestedChamber = chamberReferences.filter(
      reference => reference.chamber === expectedChamber
    );
    // Matching references to another chamber never authorize a lookup;
    // multiple contradictory identifiers in the requested chamber fail closed.
    return inRequestedChamber.length > 0 &&
      inRequestedChamber.every(reference => reference.number === numeroLegge);
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
