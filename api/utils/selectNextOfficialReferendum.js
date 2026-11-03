'use strict';

// Only official active referendum rows should be passed to this selector.
// The caller obtains them from buildQueryForTipo(..., soloInCorso=true).
function expiryTime(referendum) {
  const value = referendum?.dataFine ?? referendum?.data_fine;
  if (!value) return Number.POSITIVE_INFINITY;
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp) || new Date(timestamp).getUTCFullYear() >= 9000) {
    return Number.POSITIVE_INFINITY;
  }
  return timestamp;
}

function signatureCount(referendum) {
  const value = Number(referendum?.firme_raccolte ?? referendum?.firme ?? 0);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function selectNextOfficialReferendum(items) {
  if (!Array.isArray(items) || items.length === 0) return null;
  const valid = items.filter(item => item && typeof item === 'object');
  if (valid.length === 0) return null;
  return [...valid].sort((a, b) => {
    const byDeadline = expiryTime(a) - expiryTime(b);
    if (!Number.isNaN(byDeadline) && byDeadline !== 0) return byDeadline;
    const bySignatures = signatureCount(b) - signatureCount(a);
    if (bySignatures !== 0) return bySignatures;
    return String(a.id ?? '').localeCompare(String(b.id ?? ''));
  })[0];
}

module.exports = {selectNextOfficialReferendum};
