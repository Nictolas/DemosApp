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

const own = (row, key) => Object.prototype.hasOwnProperty.call(row, key);

function projectPublicDirectoryMembers(rows) {
  return rows.map(row => {
    const publicRow = {};
    for (const field of PUBLIC_DIRECTORY_MEMBER_FIELDS) {
      if (own(row, field)) publicRow[field] = row[field];
    }
    return publicRow;
  });
}

module.exports = { PUBLIC_DIRECTORY_MEMBER_FIELDS, projectPublicDirectoryMembers };
