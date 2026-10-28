'use strict';

// PostgreSQL timestamptz has microsecond precision. JS Date loses the final
// three digits: only lossless UTC SQL text is acceptable for GDPR event IDs.
// Keep .sssZ for exact millisecond events to preserve legacy B2/HMAC digests.
const UTC = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?Z$/;
function normalizeLedgerTimestamp(value) {
  if (typeof value !== 'string') {
    throw Error('Invalid GDPR ledger timestamp: lossless UTC text required');
  }
  const match = UTC.exec(value);
  if (!match) throw Error('Invalid GDPR ledger timestamp');
  const fraction = (match[2] || '').padEnd(6, '0');
  const milliseconds = match[1] + '.' + fraction.slice(0, 3) + 'Z';
  const date = new Date(milliseconds);
  if (!Number.isFinite(date.getTime()) || date.toISOString() !== milliseconds) {
    throw Error('Invalid GDPR ledger timestamp');
  }
  const precise = fraction.slice(3) !== '000' ? fraction : fraction.slice(0, 3);
  return match[1] + '.' + precise + 'Z';
}
function microsecondTimestamp(value) {
  const normalized = normalizeLedgerTimestamp(value);
  return normalized.replace(/\.(\d{3})Z$/, (_, ms) => '.' + ms + '000Z');
}
module.exports = { normalizeLedgerTimestamp, microsecondTimestamp };
