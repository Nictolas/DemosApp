'use strict';

// Expand/contract adapter: this file never writes user data.
// user_profile is the preferred source of self-declared residence;
// users is a legacy fallback. Official voting districts are NOT residence.
const RESIDENCE_FIELDS = Object.freeze([
  'paese_residenza',
  'regione_residenza',
  'provincia_residenza',
  'comune_residenza',
]);

const RESIDENCE_PROJECTION = RESIDENCE_FIELDS
  .map((field) => `COALESCE(p.${field}, u.${field}) AS ${field}`)
  .join(',\n       ');
const LEGACY_PROJECTION = RESIDENCE_FIELDS.join(', ');

function buildUserResidenceSql({ includeFeedSelections = false, strictProfileOwner = false } = {}) {
  const feed = includeFeedSelections ? ',\n       u.attivisti, u.organizzazioni' : '';
  // In the final contract phase explicit NULL in an existing profile must NOT
  // resurrect the old users value. Keep disabled until legacy fields are
  // reconciled, trigger ownership has moved, and all callers are migrated.
  const projection = strictProfileOwner
    ? RESIDENCE_FIELDS.map((field) =>
        `CASE WHEN p.user_id IS NOT NULL THEN p.${field} ELSE u.${field} END AS ${field}`
      ).join(',\n       ')
    : RESIDENCE_PROJECTION;
  return `SELECT u.id,
       ${projection}${feed}
FROM users u
LEFT JOIN user_profile p ON p.user_id = u.id
WHERE u.id = $1`;
}

function buildLegacyResidenceSql({ includeFeedSelections = false } = {}) {
  const feed = includeFeedSelections ? ', attivisti, organizzazioni' : '';
  return `SELECT id, ${LEGACY_PROJECTION}${feed} FROM users WHERE id = $1`;
}

function isMissingProjectionSchema(error) {
  return error?.code === '42P01' || error?.code === '42703';
}

async function loadUserResidence(db, userId, options = {}) {
  if (!db || typeof db.query !== 'function') throw new TypeError('Database query client required');
  if (!userId) throw new TypeError('User ID required');
  let result;
  try {
    result = await db.query(buildUserResidenceSql(options), [userId]);
  } catch (error) {
    if (options.strictProfileOwner || !isMissingProjectionSchema(error)) throw error;
    // Pre-user_profile deployment fallback only; keep legacy columns until cutover.
    result = await db.query(buildLegacyResidenceSql(options), [userId]);
  }
  return result.rows[0] || null;
}

module.exports = {
  RESIDENCE_FIELDS,
  buildUserResidenceSql,
  buildLegacyResidenceSql,
  loadUserResidence,
};
