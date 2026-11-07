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

// Public avatar attributes are rendering instructions, not free text fields.
// Whitelisting JSON keys alone still allows private notes or URLs to be sent
// to everyone in the value of a whitelisted attribute.
const PUBLIC_AVATAR_COLOR_KEYS = new Set([
  'skinColor','hairColor','mustacheColor','beardColor',
  'suitColor','tieColor','glassesColor'
]);
const PUBLIC_AVATAR_STYLE_VALUES = Object.freeze({
  hairStyle: new Set(['bald','classic','short','long','curly','messy','wavy','buzz','pelo']),
  mustacheStyle: new Set(['none','classic','thick','handlebar']),
  beardStyle: new Set(['none','goatee','full','stubble']),
  noseStyle: new Set(['normal','small','large','pointed','button','arrow','broad','curved']),
  glassesStyle: new Set(['none','round','square','aviator'])
});
function isPublicAvatarVisualValue(key, value) {
  if (typeof value !== 'string') return false;
  if (PUBLIC_AVATAR_COLOR_KEYS.has(key)) {
    // Current colour picker emits six-digit hex; preserve legacy 3/4/8-digit
    // CSS hex without accepting url(), var(), text notes or external sources.
    return /^#(?:[0-9A-Fa-f]{3}|[0-9A-Fa-f]{4}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(value);
  }
  return PUBLIC_AVATAR_STYLE_VALUES[key]?.has(value) === true;
}

const own = (row, key) => Object.prototype.hasOwnProperty.call(row, key);

const PUBLIC_AVATAR_FIELDS = Object.freeze([
  'skinColor', 'hairColor', 'hairStyle', 'mustacheStyle',
  'mustacheColor', 'beardStyle', 'beardColor', 'noseStyle',
  'suitColor', 'tieColor', 'glassesStyle', 'glassesColor'
]);

// avatar_config is a JSON-encoded TEXT field. The public card requires only
// the twelve CustomAvatar visual attributes, never arbitrary extra JSON keys.
// Preserve a JSON string for existing Android/web clients; tolerate legacy
// double-serialized values that the current clients already parse.
function projectPublicAvatarConfig(raw) {
  if (raw == null) return null;
  try {
    let avatar = raw;
    for (let i = 0; i < 2 && typeof avatar === 'string'; i++) {
      if (!avatar.length || avatar.length > 4096) return null;
      avatar = JSON.parse(avatar);
    }
    if (!avatar || typeof avatar !== 'object' || Array.isArray(avatar)) return null;
    const publicAvatar = {};
    for (const key of PUBLIC_AVATAR_FIELDS) {
      if (own(avatar, key) && isPublicAvatarVisualValue(key, avatar[key])) {
        publicAvatar[key] = avatar[key];
      }
    }
    return Object.keys(publicAvatar).length ? JSON.stringify(publicAvatar) : null;
  } catch (_) {
    return null;
  }
}


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
          : field === 'avatar_config'
            ? projectPublicAvatarConfig(row[field])
            : row[field];
      }
    }
    return publicRow;
  });
}

module.exports = { PUBLIC_DIRECTORY_MEMBER_FIELDS, PUBLIC_ACTIVISM_TYPE_FIELDS,
  PUBLIC_AVATAR_FIELDS, projectPublicAvatarConfig,
  projectPublicActivismTypes, projectPublicDirectoryMembers };
