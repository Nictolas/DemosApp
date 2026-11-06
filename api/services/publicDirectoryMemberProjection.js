'use strict';

// Only fields actually needed by the public Attivisti and Organizzazioni directories.
// The database query currently selects this subset too; keep this projection at the
// response boundary so any future SELECT expansion cannot expose private columns.
const PUBLIC_DIRECTORY_MEMBER_FIELDS = Object.freeze([
  'id',
  'nome',
  'cognome',
  'ruolo',
  'avatar_config',
  'regione_residenza',
  'facebook_url',
  'twitter_url',
  'instagram_url',
  'linkedin_url',
  'telegram_url',
  'website_url',
  'twitch_url',
  'youtube_url',
  'tipologie_attivismo',
  'supporters_count'
]);

// Public activism categories are JSONB documents. Never pass through arbitrary
// nested attributes (such as private notes, contact details or moderation data).
// Preserve the five documented client-facing attributes for legacy clients.
const PUBLIC_ACTIVISM_TYPE_FIELDS = Object.freeze([
  'tipo',
  'emoji',
  'nome',
  'descrizione',
  'colore'
]);

const own = (row, key) => Object.prototype.hasOwnProperty.call(row, key);

function projectPublicActivismTypes(types) {
  if (!Array.isArray(types)) return null;
  return types.filter(type => type !== null &&
      typeof type === 'object' && !Array.isArray(type))
    .map(type => {
      const publicType = {};
      for (const field of PUBLIC_ACTIVISM_TYPE_FIELDS) {
        if (own(type, field) && typeof type[field] === 'string') {
          publicType[field] = type[field];
        }
      }
      return publicType;
    });
}

function projectPublicDirectoryMembers(rows) {
  return rows.map(row => {
    const publicRow = {};
    for (const field of PUBLIC_DIRECTORY_MEMBER_FIELDS) {
      if (own(row, field)) {
        publicRow[field] = field === 'tipologie_attivismo'
          ? projectPublicActivismTypes(row[field])
          : row[field];
      }
    }
    return publicRow;
  });
}

module.exports = { PUBLIC_DIRECTORY_MEMBER_FIELDS, PUBLIC_ACTIVISM_TYPE_FIELDS,
  projectPublicActivismTypes, projectPublicDirectoryMembers };
