/**
 * Utilità per la gestione delle opinioni con compressione database
 * Frontend: "Favorevole", "Contrario", "Indeciso"
 * Database: "f", "c", "i"
 */

// Mappatura da database a frontend
const DB_TO_FRONTEND = {
  'f': 'Favorevole',
  'c': 'Contrario', 
  'i': 'Indeciso'
};

// Mappatura da frontend a database
const FRONTEND_TO_DB = {
  'Favorevole': 'f',
  'Contrario': 'c',
  'Indeciso': 'i'
};

// Mappatura da valori legacy a database
const LEGACY_TO_DB = {
  'Favorevole': 'f',
  'Contrario': 'c',
  'Indeciso': 'i',
  'favorevole': 'f',
  'contrario': 'c',
  'indeciso': 'i',
  'FAVOREVOLE': 'f',
  'CONTRARIO': 'c',
  'INDECISO': 'i'
};

// Lista delle colonne di opinioni
const OPINION_COLUMNS = [
  'energia_nucleare',
  'sperimentazione_animale', 
  'legalizzazione_canapa',
  'caccia',
  'carne_coltivata',
  'cittadina_animale',
  'nato',
  'matrimonio_gay',
  'salario_minimo',
  'case_chiuse',
  'eutanasia',
  'omobitransfobia'
];

/**
 * Converte valore database a frontend
 * @param {string} dbValue - Valore dal database ("f", "c", "i")
 * @returns {string} - Valore per frontend ("Favorevole", "Contrario", "Indeciso")
 */
function decompressOpinion(dbValue) {
  if (!dbValue) return null;
  return DB_TO_FRONTEND[dbValue] || null;
}

/**
 * Converte valore frontend a database
 * @param {string} frontendValue - Valore dal frontend ("Favorevole", "Contrario", "Indeciso")
 * @returns {string} - Valore per database ("f", "c", "i")
 */
function compressOpinion(frontendValue) {
  if (!frontendValue) return null;
  return FRONTEND_TO_DB[frontendValue] || null;
}

/**
 * Converte valore legacy a database
 * @param {string} legacyValue - Valore legacy da migrare
 * @returns {string} - Valore per database ("f", "c", "i")
 */
function migrateLegacyOpinion(legacyValue) {
  if (!legacyValue) return null;
  return LEGACY_TO_DB[legacyValue] || null;
}

/**
 * Valida valore frontend
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidFrontendOpinion(value) {
  return ['Favorevole', 'Contrario', 'Indeciso'].includes(value);
}

/**
 * Valida valore database
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidDatabaseOpinion(value) {
  return ['f', 'c', 'i'].includes(value);
}

/**
 * Ottiene tutti i valori frontend validi
 * @returns {Array} - Array dei valori validi
 */
function getValidFrontendOpinions() {
  return ['Favorevole', 'Contrario', 'Indeciso'];
}

/**
 * Ottiene tutti i valori database validi
 * @returns {Array} - Array dei valori validi
 */
function getValidDatabaseOpinions() {
  return ['f', 'c', 'i'];
}

/**
 * Ottiene la lista delle colonne di opinioni
 * @returns {Array} - Array delle colonne di opinioni
 */
function getOpinionColumns() {
  return [...OPINION_COLUMNS];
}

/**
 * Decompressione di un oggetto con opinioni
 * @param {Object} user - Oggetto utente con opinioni compresse
 * @returns {Object} - Oggetto utente con opinioni decompresse
 */
function decompressUserOpinions(user) {
  if (!user) return user;
  
  const decompressedUser = { ...user };
  
  OPINION_COLUMNS.forEach(column => {
    if (decompressedUser[column]) {
      decompressedUser[column] = decompressOpinion(decompressedUser[column]);
    }
  });
  
  return decompressedUser;
}

/**
 * Compressione di un oggetto con opinioni
 * @param {Object} user - Oggetto utente con opinioni decompresse
 * @returns {Object} - Oggetto utente con opinioni compresse
 */
function compressUserOpinions(user) {
  if (!user) return user;
  
  const compressedUser = { ...user };
  
  OPINION_COLUMNS.forEach(column => {
    if (compressedUser[column]) {
      compressedUser[column] = compressOpinion(compressedUser[column]);
    }
  });
  
  return compressedUser;
}

module.exports = {
  decompressOpinion,
  compressOpinion,
  migrateLegacyOpinion,
  isValidFrontendOpinion,
  isValidDatabaseOpinion,
  getValidFrontendOpinions,
  getValidDatabaseOpinions,
  getOpinionColumns,
  decompressUserOpinions,
  compressUserOpinions,
  DB_TO_FRONTEND,
  FRONTEND_TO_DB,
  LEGACY_TO_DB,
  OPINION_COLUMNS
};
