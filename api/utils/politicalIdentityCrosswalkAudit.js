'use strict';

// DEMOS POL-014 / POL-015 — OFFLINE preflight, never an importer or deletion approval.
// This module has no database, HTTP or filesystem dependencies.
const HOSTS = {
  CAMERA: new Set(['www.camera.it', 'dati.camera.it']),
  SENATO: new Set(['www.senato.it', 'dati.senato.it'])
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const OFFICIAL_ID = /^[a-z0-9][a-z0-9:._/-]{0,127}$/i;

function officialUrl(raw, chamber) {
  if (typeof raw !== 'string' || !HOSTS[chamber]) return false;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' &&
      !url.username && !url.password && !url.port &&
      !url.search && !url.hash &&
      HOSTS[chamber].has(url.hostname.toLowerCase()) &&
      url.pathname.length > 1;
  } catch {
    return false;
  }
}

function validDate(raw) {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
  const [year, month, day] = raw.split('-').map(Number);
  const time = new Date(Date.UTC(year, month - 1, day));
  return year >= 1946 && year <= 2100 &&
    time.getUTCFullYear() === year &&
    time.getUTCMonth() === month - 1 && time.getUTCDate() === day;
}

function overlaps(a, b) {
  return a.starts_at <= (b.ends_at || '9999-12-31') &&
    b.starts_at <= (a.ends_at || '9999-12-31');
}

/**
 * A proposed grouping is NOT proof of identity. Institutional IDs are namespaced
 * by chamber; joining a Camera ID and a Senato ID requires independent evidence.
 *
 * Input: [{case_id, user_ids: [uuid], accounts: [{user_id, has_auth}],
 *   institutional_records: [{user_id, chamber, official_id, source_url,
 *      legislature, starts_at, ends_at}], cross_chamber_evidence_url}]
 *
 * Output always requires independent manual review. It never emits executable
 * SQL, inserts, updates, deletions, or a permission to merge any user.
 */
function auditPoliticalIdentityCrosswalk(cases) {
  if (!Array.isArray(cases)) throw new TypeError('Atteso un array di casi');
  const seenCases = new Set();
  const idOwners = new Map();
  const userOwners = new Map();
  const result = [];

  for (const item of cases) {
    const errors = new Set();
    const caseId = typeof item?.case_id === 'string' && /^[a-zA-Z0-9_-]{1,80}$/.test(item.case_id)
      ? item.case_id : null;
    if (!caseId || seenCases.has(caseId)) errors.add('INVALID_OR_DUPLICATE_CASE_ID');
    if (caseId) seenCases.add(caseId);

    const ids = Array.isArray(item?.user_ids) ? item.user_ids : [];
    if (ids.length < 2 || new Set(ids).size !== ids.length || !ids.every(id => typeof id === 'string' && UUID.test(id))) {
      errors.add('INVALID_USER_GROUP');
    }
    for (const id of ids) {
      if (userOwners.has(id)) {
        errors.add('USER_IN_MULTIPLE_CASES');
        result[userOwners.get(id)].errors.add('USER_IN_MULTIPLE_CASES');
      } else userOwners.set(id, result.length);
    }

    const accounts = Array.isArray(item?.accounts) ? item.accounts : [];
    if (accounts.length !== ids.length || new Set(accounts.map(a => a?.user_id)).size !== ids.length ||
        accounts.some(a => !ids.includes(a?.user_id) || typeof a?.has_auth !== 'boolean')) {
      errors.add('AUTH_PREFLIGHT_INCOMPLETE');
    }
    if (accounts.some(a => a?.has_auth === true)) errors.add('AUTHENTICATED_ACCOUNT_REQUIRES_SEPARATE_REVIEW');

    const records = Array.isArray(item?.institutional_records) ? item.institutional_records : [];
    if (records.length < 2) errors.add('INSUFFICIENT_INSTITUTIONAL_RECORDS');
    const parsed = [];
    for (const row of records) {
      const chamber = row?.chamber;
      if (!ids.includes(row?.user_id) || !HOSTS[chamber] ||
          typeof row?.official_id !== 'string' || !OFFICIAL_ID.test(row.official_id) ||
          !officialUrl(row?.source_url, chamber) ||
          !Number.isInteger(row?.legislature) || row.legislature < 1 || row.legislature > 100 ||
          !validDate(row?.starts_at) || (row.ends_at !== null && row.ends_at !== undefined &&
            !validDate(row.ends_at))) {
        errors.add('INVALID_OR_UNVERIFIED_MANDATE');
        continue;
      }
      if (row.ends_at && row.ends_at < row.starts_at) {
        errors.add('MANDATE_END_BEFORE_START');
        continue;
      }
      const institutionalKey = chamber + ':' + row.official_id.toLowerCase();
      if (idOwners.has(institutionalKey) && idOwners.get(institutionalKey).index !== result.length) {
        errors.add('OFFICIAL_ID_IN_MULTIPLE_CASES');
        result[idOwners.get(institutionalKey).index].errors.add('OFFICIAL_ID_IN_MULTIPLE_CASES');
      } else idOwners.set(institutionalKey, { index: result.length, user_id: row.user_id });

      // One institutional identity cannot silently become two local user IDs.
      if (idOwners.get(institutionalKey).user_id !== row.user_id) {
        errors.add('OFFICIAL_ID_IN_MULTIPLE_USERS');
      }
      parsed.push(row);
    }

    if (new Set(parsed.map(r => r.user_id)).size !== ids.length) {
      errors.add('UNMATCHED_LOCAL_USER');
    }
    const chambers = new Set(parsed.map(r => r.chamber));
    if (chambers.size > 1 && !officialUrl(item?.cross_chamber_evidence_url, 'CAMERA') &&
        !officialUrl(item?.cross_chamber_evidence_url, 'SENATO')) {
      errors.add('NO_OFFICIAL_CROSS_CHAMBER_EVIDENCE');
    }
    for (let i = 0; i < parsed.length; i++) {
      for (let j = i + 1; j < parsed.length; j++) {
        if (parsed[i].chamber !== parsed[j].chamber && overlaps(parsed[i], parsed[j])) {
          errors.add('CHAMBER_MANDATE_DATE_OVERLAP');
        }
      }
    }

    result.push({ case_id: caseId || 'INVALID', errors });
  }

  return {
    mode: 'READ_ONLY_MANUAL_REVIEW',
    writes_performed: 0,
    automatic_merges_performed: 0,
    blocked_count: result.filter(r => r.errors.size).length,
    manual_review_count: result.filter(r => !r.errors.size).length,
    cases: result.map(r => ({
      case_id: r.case_id,
      review_status: r.errors.size ? 'BLOCKED' : 'MANUAL_REVIEW_REQUIRED',
      problems: [...r.errors].sort()
    }))
  };
}

module.exports = { auditPoliticalIdentityCrosswalk, officialUrl, validDate };
