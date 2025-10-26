/**
 * Utilità per la gestione delle province italiane con compressione database
 * Frontend: "Milano", "Roma", "Napoli", etc.
 * Database: "MI", "RM", "NA", etc.
 */

// Mapping da database a frontend per province
const PROVINCE_DB_TO_FRONTEND = {
  // Abruzzo
  'AQ': 'L\'Aquila',
  'CH': 'Chieti',
  'PE': 'Pescara',
  'TE': 'Teramo',
  
  // Basilicata
  'PZ': 'Potenza',
  'MT': 'Matera',
  
  // Calabria
  'CS': 'Cosenza',
  'CZ': 'Catanzaro',
  'KR': 'Crotone',
  'RC': 'Reggio Calabria',
  'VV': 'Vibo Valentia',
  
  // Campania
  'AV': 'Avellino',
  'BN': 'Benevento',
  'CE': 'Caserta',
  'NA': 'Napoli',
  'SA': 'Salerno',
  
  // Emilia-Romagna
  'BO': 'Bologna',
  'FE': 'Ferrara',
  'FC': 'Forlì-Cesena',
  'MO': 'Modena',
  'PR': 'Parma',
  'PC': 'Piacenza',
  'RA': 'Ravenna',
  'RE': 'Reggio Emilia',
  'RN': 'Rimini',
  
  // Friuli-Venezia Giulia
  'GO': 'Gorizia',
  'PN': 'Pordenone',
  'TS': 'Trieste',
  'UD': 'Udine',
  
  // Lazio
  'FR': 'Frosinone',
  'LT': 'Latina',
  'RI': 'Rieti',
  'RM': 'Roma',
  'VT': 'Viterbo',
  
  // Liguria
  'GE': 'Genova',
  'IM': 'Imperia',
  'SP': 'La Spezia',
  'SV': 'Savona',
  
  // Lombardia
  'BG': 'Bergamo',
  'BS': 'Brescia',
  'CO': 'Como',
  'CR': 'Cremona',
  'MN': 'Mantova',
  'MI': 'Milano',
  'MB': 'Monza e Brianza',
  'PV': 'Pavia',
  'SO': 'Sondrio',
  'VA': 'Varese',
  
  // Marche
  'AN': 'Ancona',
  'AP': 'Ascoli Piceno',
  'FM': 'Fermo',
  'MC': 'Macerata',
  'PU': 'Pesaro e Urbino',
  
  // Molise
  'CB': 'Campobasso',
  'IS': 'Isernia',
  
  // Piemonte
  'AL': 'Alessandria',
  'AT': 'Asti',
  'BI': 'Biella',
  'CN': 'Cuneo',
  'NO': 'Novara',
  'TO': 'Torino',
  'VB': 'Verbano-Cusio-Ossola',
  'VC': 'Vercelli',
  
  // Puglia
  'BA': 'Bari',
  'BT': 'Barletta-Andria-Trani',
  'BR': 'Brindisi',
  'FG': 'Foggia',
  'LE': 'Lecce',
  'TA': 'Taranto',
  
  // Sardegna
  'CA': 'Cagliari',
  'CI': 'Carbonia-Iglesias',
  'VS': 'Medio Campidano',
  'NU': 'Nuoro',
  'OR': 'Oristano',
  'OT': 'Olbia-Tempio',
  'SS': 'Sassari',
  'SU': 'Sud Sardegna',
  
  // Sicilia
  'AG': 'Agrigento',
  'CL': 'Caltanissetta',
  'CT': 'Catania',
  'EN': 'Enna',
  'ME': 'Messina',
  'PA': 'Palermo',
  'RG': 'Ragusa',
  'SR': 'Siracusa',
  'TP': 'Trapani',
  
  // Toscana
  'AR': 'Arezzo',
  'FI': 'Firenze',
  'GR': 'Grosseto',
  'LI': 'Livorno',
  'LU': 'Lucca',
  'MS': 'Massa-Carrara',
  'PI': 'Pisa',
  'PT': 'Pistoia',
  'PO': 'Prato',
  'SI': 'Siena',
  
  // Trentino-Alto Adige
  'BZ': 'Bolzano',
  'TN': 'Trento',
  
  // Umbria
  'PG': 'Perugia',
  'TR': 'Terni',
  
  // Valle d'Aosta
  'AO': 'Aosta',
  
  // Veneto
  'BL': 'Belluno',
  'PD': 'Padova',
  'RO': 'Rovigo',
  'TV': 'Treviso',
  'VE': 'Venezia',
  'VR': 'Verona',
  'VI': 'Vicenza'
};

// Mapping da frontend a database per province
const PROVINCE_FRONTEND_TO_DB = {};
Object.entries(PROVINCE_DB_TO_FRONTEND).forEach(([code, name]) => {
  PROVINCE_FRONTEND_TO_DB[name] = code;
});

/**
 * Converte valore database a frontend per provincia
 * @param {string} dbValue - Valore dal database ("MI", "RM", "NA")
 * @returns {string} - Valore per frontend ("Milano", "Roma", "Napoli")
 */
function decompressProvince(dbValue) {
  if (!dbValue) return null;
  return PROVINCE_DB_TO_FRONTEND[dbValue] || null;
}

/**
 * Converte valore frontend a database per provincia
 * @param {string} frontendValue - Valore dal frontend ("Milano", "Roma", "Napoli")
 * @returns {string} - Valore per database ("MI", "RM", "NA")
 */
function compressProvince(frontendValue) {
  if (!frontendValue) return null;
  
  // Prima prova il mapping standard
  if (PROVINCE_FRONTEND_TO_DB[frontendValue]) {
    return PROVINCE_FRONTEND_TO_DB[frontendValue];
  }
  
  // Se non trova nulla, prova con case insensitive
  const lowerValue = frontendValue.toLowerCase();
  for (const [name, code] of Object.entries(PROVINCE_DB_TO_FRONTEND)) {
    if (name.toLowerCase() === lowerValue) {
      return code;
    }
  }
  
  console.log('⚠️ compressProvince: Valore non riconosciuto:', frontendValue);
  return null;
}

/**
 * Valida valore frontend per provincia
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidFrontendProvince(value) {
  return Object.values(PROVINCE_DB_TO_FRONTEND).includes(value);
}

/**
 * Valida valore database per provincia
 * @param {string} value - Valore da validare
 * @returns {boolean} - True se valido
 */
function isValidDatabaseProvince(value) {
  return Object.keys(PROVINCE_DB_TO_FRONTEND).includes(value);
}

/**
 * Ottiene tutti i valori frontend validi per province
 * @returns {Array} - Array dei valori validi
 */
function getValidFrontendProvinces() {
  return Object.values(PROVINCE_DB_TO_FRONTEND);
}

/**
 * Ottiene tutti i valori database validi per province
 * @returns {Array} - Array dei valori validi
 */
function getValidDatabaseProvinces() {
  return Object.keys(PROVINCE_DB_TO_FRONTEND);
}

module.exports = {
  decompressProvince,
  compressProvince,
  isValidFrontendProvince,
  isValidDatabaseProvince,
  getValidFrontendProvinces,
  getValidDatabaseProvinces,
  PROVINCE_DB_TO_FRONTEND,
  PROVINCE_FRONTEND_TO_DB
};
