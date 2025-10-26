/**
 * Utilità per la gestione del genere con compressione database
 * Frontend: "Uomo", "Donna", "Altro"
 * Database: "u", "d", "a"
 */

// Mappatura da database a frontend
const DB_TO_FRONTEND = {
  'u': 'Uomo',
  'd': 'Donna', 
  'a': 'Altro'
};

// Mappatura da frontend a database
const FRONTEND_TO_DB = {
  'Uomo': 'u',
  'Donna': 'd',
  'Altro': 'a'
};

// Mappatura da valori legacy a database
const LEGACY_TO_DB = {
  'uomo': 'u',
  'donna': 'd',
  'altro': 'a',
  'maschio': 'u',
  'femmina': 'd',
  'M': 'u',
  'F': 'd',
  'Maschio': 'u',
  'Femmina': 'd'
};

/**
 * Converte valore database a frontend
 * @param {string} dbValue - Valore dal database ("u", "d", "a")
 * @returns {string} - Valore per frontend ("Uomo", "Donna", "Altro")
 */
function decompressGender(dbValue) {
  if (!dbValue) return null;
  return DB_TO_FRONTEND[dbValue] || null;
}

/**
 * Converte valore frontend a database
 * @param {string} frontendValue - Valore dal frontend ("Uomo", "Donna", "Altro")
 * @returns {string} - Valore per database ("u", "d", "a")
 */
function compressGender(frontendValue) {
  if (!frontendValue) return null;
  
  // Prima prova il mapping standard
  if (FRONTEND_TO_DB[frontendValue]) {
    return FRONTEND_TO_DB[frontendValue];
  }
  
  // Poi prova il mapping legacy
  if (LEGACY_TO_DB[frontendValue]) {
    return LEGACY_TO_DB[frontendValue];
  }
  
  // Se non trova nulla, prova con case insensitive
  const lowerValue = frontendValue.toLowerCase();
  if (LEGACY_TO_DB[lowerValue]) {
    return LEGACY_TO_DB[lowerValue];
  }
  
  console.log('⚠️ compressGender: Valore non riconosciuto:', frontendValue);
  return null;
}

/**
 * Converte valore legacy a database
 * @param {string} legacyValue - Valore legacy da migrare
 * @returns {string} - Valore per database ("u", "d", "a")
 */
function migrateLegacyGender(legacyValue) {
  if (!legacyValue) return null;
  return LEGACY_TO_DB[legacyValue] || 'a'; // Default ad "altro" se non riconosciuto
}

/**
 * Valida valore frontend
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidFrontendGender(value) {
  return ['Uomo', 'Donna', 'Altro'].includes(value);
}

/**
 * Valida valore database
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidDatabaseGender(value) {
  return ['u', 'd', 'a'].includes(value);
}

/**
 * Ottiene tutti i valori frontend validi
 * @returns {Array} - Array dei valori validi
 */
function getValidFrontendGenders() {
  return ['Uomo', 'Donna', 'Altro'];
}

/**
 * Ottiene tutti i valori database validi
 * @returns {Array} - Array dei valori validi
 */
function getValidDatabaseGenders() {
  return ['u', 'd', 'a'];
}

module.exports = {
  decompressGender,
  compressGender,
  migrateLegacyGender,
  isValidFrontendGender,
  isValidDatabaseGender,
  getValidFrontendGenders,
  getValidDatabaseGenders,
  DB_TO_FRONTEND,
  FRONTEND_TO_DB,
  LEGACY_TO_DB
};
