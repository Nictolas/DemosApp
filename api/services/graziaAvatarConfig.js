'use strict';

// Save exactly the editable fields of DEMOS's existing AvatarEditor.
// No pictures, URLs, scripts, or unrelated profile data are accepted.
const colorFields = [
  'skinColor', 'hairColor', 'mustacheColor', 'beardColor',
  'suitColor', 'tieColor', 'glassesColor'
];
const styleFields = [
  'hairStyle', 'mustacheStyle', 'beardStyle', 'noseStyle', 'glassesStyle'
];
const keys = [...colorFields, ...styleFields];

function parseGraziaAvatarConfig(config) {
  if (!config || typeof config !== 'object' || Array.isArray(config)) return null;
  if (Object.keys(config).length !== keys.length) return null;
  const saved = {};
  for (const key of keys) {
    const value = config[key];
    if (typeof value !== 'string') return null;
    if (colorFields.includes(key)) {
      if (!/^#[0-9a-f]{6}$/i.test(value)) return null;
    } else if (!/^[a-z][a-z0-9_-]{0,31}$/i.test(value)) {
      return null;
    }
    saved[key] = value;
  }
  return saved;
}

module.exports = { parseGraziaAvatarConfig };
