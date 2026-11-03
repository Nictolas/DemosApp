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
  // "S." and "C." identify different Italian parliamentary chambers;
  // a matching number is not proof that these two acts are the same.
  const chamber = titolo.match(/(?:^|[\s(])([SC])\.\s*(\d{1,5})\b/i);
  if (chamber && chamber[2] === numeroLegge) {
    if (chamber[1].toUpperCase() === 'S' && camera !== 'Senato') return false;
    if (chamber[1].toUpperCase() === 'C' && camera !== 'Camera') return false;
  }
  return true;
}

module.exports = { estraiNumeroLegge, canSearchItalianBills, canSearchActTitle };
