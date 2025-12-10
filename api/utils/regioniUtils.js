/**
 * Utilità per la gestione delle regioni italiane con compressione database
 * Frontend: "Lombardia", "Toscana", "Sicilia", etc.
 * Database: "LO", "TO", "SI", etc. (codici ISTAT ufficiali)
 */

// Mapping da database a frontend per regioni (codici ISTAT)
const REGIONI_DB_TO_FRONTEND = {
  'AB': 'Abruzzo',
  'BA': 'Basilicata',
  'CA': 'Calabria',
  'CM': 'Campania',
  'ER': 'Emilia-Romagna',
  'FG': 'Friuli-Venezia Giulia',
  'LA': 'Lazio',
  'LI': 'Liguria',
  'LO': 'Lombardia',
  'MA': 'Marche',
  'MO': 'Molise',
  'PI': 'Piemonte',
  'PU': 'Puglia',
  'SA': 'Sardegna',
  'SI': 'Sicilia',
  'TO': 'Toscana',
  'TN': 'Trentino-Alto Adige',
  'UM': 'Umbria',
  'VA': 'Valle d\'Aosta',
  'VE': 'Veneto'
};

// Mapping da frontend a database per regioni
const REGIONI_FRONTEND_TO_DB = {};
Object.entries(REGIONI_DB_TO_FRONTEND).forEach(([code, name]) => {
  REGIONI_FRONTEND_TO_DB[name] = code;
});

/**
 * Converte valore database a frontend per regione
 * @param {string} dbValue - Valore dal database ("LO", "TO", "SI")
 * @returns {string} - Valore per frontend ("Lombardia", "Toscana", "Sicilia")
 */
function decompressRegione(dbValue) {
  if (!dbValue) return null;
  return REGIONI_DB_TO_FRONTEND[dbValue] || null;
}

/**
 * Converte valore frontend a database per regione
 * @param {string} frontendValue - Valore dal frontend ("Lombardia", "Toscana", "Sicilia")
 * @returns {string} - Valore per database ("LO", "TO", "SI")
 */
function compressRegione(frontendValue) {
  if (!frontendValue) return null;
  
  // Prima prova il mapping standard
  if (REGIONI_FRONTEND_TO_DB[frontendValue]) {
    return REGIONI_FRONTEND_TO_DB[frontendValue];
  }
  
  // Se non trova nulla, prova con case insensitive e normalizzazione
  const normalizedValue = frontendValue.toLowerCase().trim();
  // Cerca nei valori (nomi delle regioni), non nelle chiavi (codici)
  for (const [code, name] of Object.entries(REGIONI_DB_TO_FRONTEND)) {
    if (name.toLowerCase().trim() === normalizedValue) {
      return code;
    }
  }
  
  // Prova anche con normalizzazione degli spazi e trattini
  const normalizedWithSpaces = normalizedValue.replace(/\s+/g, ' ').replace(/-/g, ' ');
  for (const [code, name] of Object.entries(REGIONI_DB_TO_FRONTEND)) {
    const normalizedName = name.toLowerCase().trim().replace(/\s+/g, ' ');
    if (normalizedName === normalizedWithSpaces) {
      return code;
    }
  }
  
  console.log('⚠️ compressRegione: Valore non riconosciuto:', frontendValue);
  return null;
}

/**
 * Valida valore frontend per regione
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidFrontendRegione(value) {
  return Object.values(REGIONI_DB_TO_FRONTEND).includes(value);
}

/**
 * Valida valore database per regione
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidDatabaseRegione(value) {
  return Object.keys(REGIONI_DB_TO_FRONTEND).includes(value);
}

/**
 * Ottiene tutti i valori frontend validi per regioni
 * @returns {Array} - Array dei valori validi
 */
function getValidFrontendRegioni() {
  return Object.values(REGIONI_DB_TO_FRONTEND);
}

/**
 * Ottiene tutti i valori database validi per regioni
 * @returns {Array} - Array dei valori validi
 */
function getValidDatabaseRegioni() {
  return Object.keys(REGIONI_DB_TO_FRONTEND);
}

module.exports = {
  decompressRegione,
  compressRegione,
  isValidFrontendRegione,
  isValidDatabaseRegione,
  getValidFrontendRegioni,
  getValidDatabaseRegioni,
  REGIONI_DB_TO_FRONTEND,
  REGIONI_FRONTEND_TO_DB
};
