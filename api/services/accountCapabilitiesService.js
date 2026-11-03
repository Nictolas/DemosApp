const LEGACY_SCHEMA_ERROR_CODES = new Set(['42P01', '42703']); // undefined_table / undefined_column

const ACCOUNT_TYPES = Object.freeze({
  PERSON: 'PERSON',
  INSTITUTION: 'INSTITUTION',
  ORGANIZATION: 'ORGANIZATION'
});

// Transitional storage: old labels and new 1-letter database codes.
// Keep stable descriptive API semantics while both DB encodings coexist.
const ACCOUNT_TYPE_CODES = Object.freeze({ PERSON: 'P', ORGANIZATION: 'O', INSTITUTION: 'E' });
function normalizeAccountType(value) {
  const code = String(value || '').toUpperCase();
  if (code === 'P' || code === 'PERSON') return ACCOUNT_TYPES.PERSON;
  if (code === 'O' || code === 'ORGANIZATION') return ACCOUNT_TYPES.ORGANIZATION;
  if (code === 'E' || code === 'INSTITUTION') return ACCOUNT_TYPES.INSTITUTION;
  return null;
}

function normalizeLegacyRole(role) {
  const value = String(role || '').trim();
  const aliases = {
    Elettore: 'E',
    Politico: 'P',
    Candidato: 'C',
    'Candidato Politico': 'CP',
    Attivista: 'A',
    Istituzione: 'I',
    Organizzazione: 'O',
    Admin: 'AD'
  };
  return aliases[value] || value || 'E';
}

function capabilitiesFromLegacyRole(role) {
  const legacyRole = normalizeLegacyRole(role);
  return {
    accountType:
      legacyRole === 'I'
        ? ACCOUNT_TYPES.INSTITUTION
        : legacyRole === 'O'
          ? ACCOUNT_TYPES.ORGANIZATION
          : ACCOUNT_TYPES.PERSON,
    isAdmin: legacyRole === 'AD',
    isActivist: legacyRole === 'A',
    isCandidate: legacyRole === 'C' || legacyRole === 'CP',
    isPolitician: legacyRole === 'P' || legacyRole === 'CP'
  };
}

function deriveLegacyRole(capabilities = {}) {
  const accountType = normalizeAccountType(capabilities.accountType) || ACCOUNT_TYPES.PERSON;
  if (accountType === ACCOUNT_TYPES.INSTITUTION) return 'I';
  if (accountType === ACCOUNT_TYPES.ORGANIZATION) return 'O';

  // During the compatibility window AD remains the legacy role with highest precedence.
  // The composable public capabilities are still available separately on req.user.
  if (capabilities.isAdmin) return 'AD';
  if (capabilities.isPolitician && capabilities.isCandidate) return 'CP';
  if (capabilities.isPolitician) return 'P';
  if (capabilities.isCandidate) return 'C';
  if (capabilities.isActivist) return 'A';
  return 'E';
}

function normalizeNewModelRow(row) {
  const capabilities = {
    accountType: normalizeAccountType(row.account_type) || ACCOUNT_TYPES.PERSON,
    isAdmin: Boolean(row.is_admin),
    isActivist: Boolean(row.is_activist),
    isCandidate: Boolean(row.is_candidate),
    isPolitician: Boolean(row.is_politician)
  };

  return {
    id: row.id,
    status: row.status,
    legacyRole: deriveLegacyRole(capabilities),
    capabilities
  };
}

function normalizeLegacyRow(row) {
  const capabilities = capabilitiesFromLegacyRole(row.ruolo);
  return {
    id: row.id,
    status: row.status,
    legacyRole: normalizeLegacyRole(row.ruolo),
    capabilities
  };
}

async function getAccountSubject(pool, userId) {
  try {
    const result = await pool.query(
      `
      SELECT
        u.id,
        u.status,
        u.account_type,
        u.is_admin,
        u.is_activist,
        EXISTS (
          SELECT 1
          FROM political_candidacies pc
          WHERE pc.user_id = u.id
            AND pc.status = 'ACTIVE'
            AND pc.starts_at <= NOW()
            AND (pc.ends_at IS NULL OR pc.ends_at > NOW())
        ) AS is_candidate,
        EXISTS (
          SELECT 1
          FROM political_mandates pm
          WHERE pm.user_id = u.id
            AND pm.status = 'ACTIVE'
            AND pm.starts_at <= NOW()
            AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
        ) AS is_politician
      FROM users u
      WHERE u.id = $1
      `,
      [userId]
    );

    if (result.rows.length === 0) return null;
    return normalizeNewModelRow(result.rows[0]);
  } catch (error) {
    if (!LEGACY_SCHEMA_ERROR_CODES.has(error?.code)) throw error;

    // Deployment-safe fallback: code can be released before the additive DB migration.
    const legacyResult = await pool.query(
      'SELECT id, status, ruolo FROM users WHERE id = $1',
      [userId]
    );
    if (legacyResult.rows.length === 0) return null;
    return normalizeLegacyRow(legacyResult.rows[0]);
  }
}

async function queryWithAccountModelFallback(pool, modernSql, legacySql, values = []) {
  try {
    return await pool.query(modernSql, values);
  } catch (error) {
    if (!LEGACY_SCHEMA_ERROR_CODES.has(error?.code)) throw error;
    return pool.query(legacySql, values);
  }
}

function hasCapability(subject, capability) {
  return Boolean(subject?.capabilities?.[capability]);
}

module.exports = {
  ACCOUNT_TYPES,
  ACCOUNT_TYPE_CODES,
  normalizeAccountType,
  LEGACY_SCHEMA_ERROR_CODES,
  normalizeLegacyRole,
  capabilitiesFromLegacyRole,
  deriveLegacyRole,
  normalizeNewModelRow,
  normalizeLegacyRow,
  getAccountSubject,
  queryWithAccountModelFallback,
  hasCapability
};
