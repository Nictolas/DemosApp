'use strict';

/**
 * Strictly conservative first-party ads eligibility. DEMOS stores birth year
 * rather than an exact verified birthday. Anyone who might still be under 18
 * on any day of the current calendar year remains ineligible.
 *
 * This returns ONLY a boolean for the authenticated session. Do not send a
 * birth year, account ID, region or political data to the advertising SDK.
 */
function birthYear(value) {
  if (value instanceof Date) {
    return Number.isFinite(value.getTime()) ? value.getUTCFullYear() : null;
  }
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const raw = String(value).trim();
  if (/^\d{4}$/.test(raw)) return Number(raw);
  const iso = raw.match(/^(\d{4})-\d{2}-\d{2}(?:$|[T ])/) ;
  if (iso) return Number(iso[1]);
  const italian = raw.match(/^\d{1,2}\/\d{1,2}\/(\d{4})$/);
  return italian ? Number(italian[1]) : null;
}

function isConfirmedAdultForAds(value, now = new Date()) {
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) return false;
  const year = birthYear(value);
  return Number.isInteger(year)
    && year >= 1900
    && year <= now.getUTCFullYear() - 19;
}

module.exports = { isConfirmedAdultForAds };
