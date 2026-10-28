'use strict';

// During expand/contract these fields are mirrored atomically to user_profile.
// Keep the allowlist explicit: SQL identifiers must never come from HTTP input.
const PROFILE_FIELDS = new Set([
  'genere', 'data_nascita', 'cittadinanza',
  'paese_residenza', 'regione_residenza', 'provincia_residenza', 'comune_residenza',
  'grado_elezione', 'paese_elezione', 'regione_elezione', 'provincia_elezione', 'comune_elezione',
  'grado_candidatura', 'paese_candidatura', 'regione_candidatura', 'provincia_candidatura', 'comune_candidatura',
  'facebook_url', 'twitter_url', 'instagram_url', 'linkedin_url', 'telegram_url',
  'website_url', 'twitch_url', 'youtube_url', 'avatar_config',
]);

function buildUserProfileUpsert(fields) {
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) throw new TypeError('Profile fields object required');
  const entries = Object.entries(fields).filter(([key, value]) => PROFILE_FIELDS.has(key) && value !== undefined);
  if (!entries.length) return null;
  const columns = entries.map(([key]) => key);
  const values = entries.map(([, value]) => value);
  const placeholders = columns.map((_, i) => `$${i + 2}`);
  const assignments = columns.map((key) => `${key} = EXCLUDED.${key}`);
  return {
    sql: `INSERT INTO user_profile (user_id, ${columns.join(', ')})
          VALUES ($1, ${placeholders.join(', ')})
          ON CONFLICT (user_id) DO UPDATE SET
            ${assignments.join(',\n            ')},
            updated_at = NOW()`,
    values,
  };
}

async function upsertUserProfileFields(client, userId, fields) {
  if (!client || typeof client.query !== 'function') throw new TypeError('Transactional database client required');
  if (!userId) throw new TypeError('User ID required');
  const statement = buildUserProfileUpsert(fields);
  if (!statement) return false;
  await client.query(statement.sql, [userId, ...statement.values]);
  return true;
}

module.exports = { PROFILE_FIELDS, buildUserProfileUpsert, upsertUserProfileFields };
