/**
 * Utilità per la gestione di cittadinanza e paese residenza con compressione database
 * Frontend: "Italiana", "Italia", "Straniera", etc.
 * Database: "it", "it", "st", etc.
 */

// Mappatura da database a frontend per cittadinanza
const CITIZENSHIP_DB_TO_FRONTEND = {
  'it': 'Italiana',
  'st': 'Straniera'
};

// Mappatura da frontend a database per cittadinanza
const CITIZENSHIP_FRONTEND_TO_DB = {
  'Italiana': 'it',
  'Straniera': 'st'
};

// Mappatura da database a frontend per paese residenza
const COUNTRY_DB_TO_FRONTEND = {
  'it': 'Italia',
  'st': 'Straniero'
};

// Mappatura da frontend a database per paese residenza
const COUNTRY_FRONTEND_TO_DB = {
  'Italia': 'it',
  'Straniero': 'st'
};

// Mappatura da valori legacy a database per cittadinanza
const CITIZENSHIP_LEGACY_TO_DB = {
  'Italiana': 'it',
  'Straniera': 'st',
  'italiana': 'it',
  'straniera': 'st',
  'ITALIANA': 'it',
  'STRANIERA': 'st'
};

// Mappatura da valori legacy a database per paese residenza
const COUNTRY_LEGACY_TO_DB = {
  'Italia': 'it',
  'Straniero': 'st',
  'italia': 'it',
  'straniero': 'st',
  'ITALIA': 'it',
  'STRANIERO': 'st'
};

/**
 * Converte valore database a frontend per cittadinanza
 * @param {string} dbValue - Valore dal database ("it", "st")
 * @returns {string} - Valore per frontend ("Italiana", "Straniera")
 */
function decompressCitizenship(dbValue) {
  if (!dbValue) return null;
  return CITIZENSHIP_DB_TO_FRONTEND[dbValue] || null;
}

/**
 * Converte valore frontend a database per cittadinanza
 * @param {string} frontendValue - Valore dal frontend ("Italiana", "Straniera")
 * @returns {string} - Valore per database ("it", "st")
 */
function compressCitizenship(frontendValue) {
  if (!frontendValue) return null;
  
  // Prima prova il mapping standard
  if (CITIZENSHIP_FRONTEND_TO_DB[frontendValue]) {
    return CITIZENSHIP_FRONTEND_TO_DB[frontendValue];
  }
  
  // Poi prova il mapping legacy
  if (CITIZENSHIP_LEGACY_TO_DB[frontendValue]) {
    return CITIZENSHIP_LEGACY_TO_DB[frontendValue];
  }
  
  // Se non trova nulla, prova con case insensitive
  const lowerValue = frontendValue.toLowerCase();
  if (CITIZENSHIP_LEGACY_TO_DB[lowerValue]) {
    return CITIZENSHIP_LEGACY_TO_DB[lowerValue];
  }
  
  console.log('⚠️ compressCitizenship: Valore non riconosciuto:', frontendValue);
  return null;
}

/**
 * Converte valore database a frontend per paese residenza
 * @param {string} dbValue - Valore dal database ("it", "st")
 * @returns {string} - Valore per frontend ("Italia", "Straniero")
 */
function decompressCountry(dbValue) {
  if (!dbValue) return null;
  return COUNTRY_DB_TO_FRONTEND[dbValue] || null;
}

/**
 * Converte valore frontend a database per paese residenza
 * @param {string} frontendValue - Valore dal frontend ("Italia", "Straniero")
 * @returns {string} - Valore per database ("it", "st")
 */
function compressCountry(frontendValue) {
  if (!frontendValue) return null;
  
  // Prima prova il mapping standard
  if (COUNTRY_FRONTEND_TO_DB[frontendValue]) {
    return COUNTRY_FRONTEND_TO_DB[frontendValue];
  }
  
  // Poi prova il mapping legacy
  if (COUNTRY_LEGACY_TO_DB[frontendValue]) {
    return COUNTRY_LEGACY_TO_DB[frontendValue];
  }
  
  // Se non trova nulla, prova con case insensitive
  const lowerValue = frontendValue.toLowerCase();
  if (COUNTRY_LEGACY_TO_DB[lowerValue]) {
    return COUNTRY_LEGACY_TO_DB[lowerValue];
  }
  
  console.log('⚠️ compressCountry: Valore non riconosciuto:', frontendValue);
  return null;
}

/**
 * Converte valore legacy a database per cittadinanza
 * @param {string} legacyValue - Valore legacy da migrare
 * @returns {string} - Valore per database ("it", "st")
 */
function migrateLegacyCitizenship(legacyValue) {
  if (!legacyValue) return null;
  return CITIZENSHIP_LEGACY_TO_DB[legacyValue] || null;
}

/**
 * Converte valore legacy a database per paese residenza
 * @param {string} legacyValue - Valore legacy da migrare
 * @returns {string} - Valore per database ("it", "st")
 */
function migrateLegacyCountry(legacyValue) {
  if (!legacyValue) return null;
  return COUNTRY_LEGACY_TO_DB[legacyValue] || null;
}

/**
 * Valida valore frontend per cittadinanza
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidFrontendCitizenship(value) {
  return ['Italiana', 'Straniera'].includes(value);
}

/**
 * Valida valore database per cittadinanza
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidDatabaseCitizenship(value) {
  return ['it', 'st'].includes(value);
}

/**
 * Valida valore frontend per paese residenza
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidFrontendCountry(value) {
  return ['Italia', 'Straniero'].includes(value);
}

/**
 * Valida valore database per paese residenza
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidDatabaseCountry(value) {
  return ['it', 'st'].includes(value);
}

/**
 * Ottiene tutti i valori frontend validi per cittadinanza
 * @returns {Array} - Array dei valori validi
 */
function getValidFrontendCitizenships() {
  return ['Italiana', 'Straniera'];
}

/**
 * Ottiene tutti i valori database validi per cittadinanza
 * @returns {Array} - Array dei valori validi
 */
function getValidDatabaseCitizenships() {
  return ['it', 'st'];
}

/**
 * Ottiene tutti i valori frontend validi per paese residenza
 * @returns {Array} - Array dei valori validi
 */
function getValidFrontendCountries() {
  return ['Italia', 'Straniero'];
}

/**
 * Ottiene tutti i valori database validi per paese residenza
 * @returns {Array} - Array dei valori validi
 */
function getValidDatabaseCountries() {
  return ['it', 'st'];
}

/**
 * Decompressione di un oggetto con cittadinanza e paesi (residenza, elezione, candidatura)
 * @param {Object} user - Oggetto utente con valori compressi
 * @returns {Object} - Oggetto utente con valori decompressi
 */
function decompressUserLocation(user) {
  if (!user) return user;
  
  const decompressedUser = { ...user };
  
  if (decompressedUser.cittadinanza) {
    decompressedUser.cittadinanza = decompressCitizenship(decompressedUser.cittadinanza);
  }
  
  if (decompressedUser.paese_residenza) {
    decompressedUser.paese_residenza = decompressCountry(decompressedUser.paese_residenza);
  }
  
  if (decompressedUser.paese_elezione) {
    decompressedUser.paese_elezione = decompressCountry(decompressedUser.paese_elezione);
  }
  
  if (decompressedUser.paese_candidatura) {
    decompressedUser.paese_candidatura = decompressCountry(decompressedUser.paese_candidatura);
  }
  
  return decompressedUser;
}

/**
 * Compressione di un oggetto con cittadinanza e paesi (residenza, elezione, candidatura)
 * @param {Object} user - Oggetto utente con valori decompressi
 * @returns {Object} - Oggetto utente con valori compresse
 */
function compressUserLocation(user) {
  if (!user) return user;
  
  const compressedUser = { ...user };
  
  if (compressedUser.cittadinanza) {
    compressedUser.cittadinanza = compressCitizenship(compressedUser.cittadinanza);
  }
  
  if (compressedUser.paese_residenza) {
    compressedUser.paese_residenza = compressCountry(compressedUser.paese_residenza);
  }
  
  if (compressedUser.paese_elezione) {
    compressedUser.paese_elezione = compressCountry(compressedUser.paese_elezione);
  }
  
  if (compressedUser.paese_candidatura) {
    compressedUser.paese_candidatura = compressCountry(compressedUser.paese_candidatura);
  }
  
  return compressedUser;
}

module.exports = {
  decompressCitizenship,
  compressCitizenship,
  decompressCountry,
  compressCountry,
  migrateLegacyCitizenship,
  migrateLegacyCountry,
  isValidFrontendCitizenship,
  isValidDatabaseCitizenship,
  isValidFrontendCountry,
  isValidDatabaseCountry,
  getValidFrontendCitizenships,
  getValidDatabaseCitizenships,
  getValidFrontendCountries,
  getValidDatabaseCountries,
  decompressUserLocation,
  compressUserLocation,
  CITIZENSHIP_DB_TO_FRONTEND,
  CITIZENSHIP_FRONTEND_TO_DB,
  COUNTRY_DB_TO_FRONTEND,
  COUNTRY_FRONTEND_TO_DB,
  CITIZENSHIP_LEGACY_TO_DB,
  COUNTRY_LEGACY_TO_DB
};
