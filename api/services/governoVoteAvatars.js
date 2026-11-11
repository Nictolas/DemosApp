const { queryWithAccountModelFallback } = require('./accountCapabilitiesService');

// Only avatars belonging to public activist, politician or candidate profiles.
// The names are taken from the already-loaded voting results: no per-card requests.
function normalizeVoteName(name) {
  return typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').toLowerCase() : '';
}

function parseExistingAvatar(value) {
  for (let i = 0; i < 2 && typeof value === 'string'; i++) {
    try { value = JSON.parse(value); } catch { return null; }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  // Do not create default avatars for names that have none.
  return typeof value.skinColor === 'string' && typeof value.hairStyle === 'string'
    ? value
    : null;
}

async function loadGovernmentVoteAvatars(pool, names) {
  const keys = [...new Set(names.map(normalizeVoteName).filter(Boolean))];
  if (keys.length === 0) return {};

  const selectedName = `LOWER(TRIM(REGEXP_REPLACE(CONCAT_WS(' ', u.nome, u.cognome), '\\s+', ' ', 'g')))`;

  const modernSql = `
    SELECT ${selectedName} AS name_key,
           COALESCE(up.avatar_config::text, u.avatar_config::text) AS avatar_config
    FROM users u
    LEFT JOIN user_profile up ON up.user_id = u.id
    WHERE u.status IN ('a', 'v')
      AND ${selectedName} = ANY($1::text[])
      AND (
        COALESCE(u.is_activist, FALSE) = TRUE
        OR EXISTS (
          SELECT 1 FROM political_candidacies pc
          WHERE pc.user_id = u.id AND pc.status = 'ACTIVE'
            AND pc.starts_at <= NOW()
            AND (pc.ends_at IS NULL OR pc.ends_at > NOW())
        )
        OR EXISTS (
          SELECT 1 FROM political_mandates pm
          WHERE pm.user_id = u.id AND pm.status = 'ACTIVE'
            AND pm.starts_at <= NOW()
            AND (pm.ends_at IS NULL OR pm.ends_at > NOW())
        )
      )
  `;
  const legacySql = `
    SELECT ${selectedName} AS name_key, u.avatar_config::text AS avatar_config
    FROM users u
    WHERE u.status IN ('a', 'v')
      AND ${selectedName} = ANY($1::text[])
      AND u.ruolo IN ('P', 'C', 'CP', 'A', 'Politico', 'Candidato', 'Candidato Politico', 'Attivista')
  `;

  const result = await queryWithAccountModelFallback(pool, modernSql, legacySql, [keys]);
  const avatarsByName = {};
  const ambiguous = new Set();

  for (const row of result.rows) {
    const key = normalizeVoteName(row.name_key);
    if (!key || ambiguous.has(key)) continue;
    if (Object.prototype.hasOwnProperty.call(avatarsByName, key)) {
      delete avatarsByName[key];
      ambiguous.add(key);
      continue;
    }
    // Track names even if they have no avatar, so duplicate public profiles
    // cannot lead to a misleading match.
    avatarsByName[key] = parseExistingAvatar(row.avatar_config);
  }

  return Object.fromEntries(Object.entries(avatarsByName).filter(([, avatar]) => avatar !== null));
}

module.exports = { normalizeVoteName, parseExistingAvatar, loadGovernmentVoteAvatars };
