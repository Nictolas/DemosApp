/**
 * Utilità per la conversione dei dati geografici degli eventi
 * Converte i valori compressi dal database in formato leggibile per l'utente
 */

// Mapping da database a frontend per regioni (codici ISTAT)
const REGIONI_DB_TO_FRONTEND: Record<string, string> = {
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
const REGIONI_FRONTEND_TO_DB: Record<string, string> = {};
Object.entries(REGIONI_DB_TO_FRONTEND).forEach(([code, name]) => {
  REGIONI_FRONTEND_TO_DB[name] = code;
});

// Mapping da database a frontend per province
const PROVINCE_DB_TO_FRONTEND: Record<string, string> = {
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
  'OG': 'Ogliastra',
  'OT': 'Olbia-Tempio',
  'OR': 'Oristano',
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
const PROVINCE_FRONTEND_TO_DB: Record<string, string> = {};
Object.entries(PROVINCE_DB_TO_FRONTEND).forEach(([code, name]) => {
  PROVINCE_FRONTEND_TO_DB[name] = code;
});

/**
 * Converte il paese compresso in formato leggibile
 * @param {string} paeseCompresso - Valore dal database ("it", "st")
 * @returns {string} - Valore per frontend ("Italia", "Straniero")
 */
export function decompressPaeseEvento(paeseCompresso: string | null): string {
  if (!paeseCompresso) return '';
  
  const mapping: Record<string, string> = {
    'it': 'Italia',
    'st': 'Straniero'
  };
  
  return mapping[paeseCompresso] || paeseCompresso;
}

/**
 * Converte la regione compressa in formato leggibile
 * @param {string} regioneCompressa - Valore dal database ("LO", "TO", "SI")
 * @returns {string} - Valore per frontend ("Lombardia", "Toscana", "Sicilia")
 */
export function decompressRegioneEvento(regioneCompressa: string | null): string {
  if (!regioneCompressa) return '';
  
  return REGIONI_DB_TO_FRONTEND[regioneCompressa] || regioneCompressa;
}

/**
 * Converte la provincia compressa in formato leggibile
 * @param {string} provinciaCompressa - Valore dal database ("MI", "RM", "NA")
 * @returns {string} - Valore per frontend ("Milano", "Roma", "Napoli")
 */
export function decompressProvinciaEvento(provinciaCompressa: string | null): string {
  if (!provinciaCompressa) return '';
  
  return PROVINCE_DB_TO_FRONTEND[provinciaCompressa] || provinciaCompressa;
}

/**
 * Formatta la localizzazione completa dell'evento
 * @param {object} evento - Oggetto evento con dati geografici
 * @returns {string} - Stringa formattata della localizzazione
 */
export function formatEventoLocation(evento: {
  paese_evento?: string | null;
  regione_evento?: string | null;
  provincia_evento?: string | null;
  comune_evento?: string | null;
  indirizzo_evento?: string | null;
}): string {
  const paese = decompressPaeseEvento(evento.paese_evento);
  const regione = decompressRegioneEvento(evento.regione_evento);
  const provincia = decompressProvinciaEvento(evento.provincia_evento);
  const comune = evento.comune_evento || '';
  const indirizzo = evento.indirizzo_evento || '';
  
  const parts = [comune, provincia, regione, paese].filter(Boolean);
  
  if (indirizzo) {
    return `${indirizzo}, ${parts.join(', ')}`;
  }
  
  return parts.join(', ');
}

/**
 * Formatta SOLO la provincia per eventi "Elezioni"
 * (non deve mostrare la regione_evento sulle card)
 * @param {object} evento - Oggetto evento con dati geografici
 * @returns {string} - Stringa formattata della provincia
 */
export function formatEventoElezioniLocation(evento: {
  provincia_evento?: string | null;
}): string {
  const provincia = decompressProvinciaEvento(evento.provincia_evento);
  return provincia || '';
}

/**
 * Converte il paese dal frontend al formato compresso per il database
 * @param {string} paeseFrontend - Valore dal frontend ("Italia", "Straniero")
 * @returns {string} - Valore per database ("it", "st")
 */
export function compressPaeseEvento(paeseFrontend: string | null): string {
  if (!paeseFrontend) return '';
  
  const mapping: Record<string, string> = {
    'Italia': 'it',
    'Straniero': 'st'
  };
  
  return mapping[paeseFrontend] || paeseFrontend;
}

/**
 * Converte la regione dal frontend al formato compresso per il database
 * @param {string} regioneFrontend - Valore dal frontend ("Lombardia", "Toscana", "Sicilia")
 * @returns {string} - Valore per database ("LO", "TO", "SI")
 */
export function compressRegioneEvento(regioneFrontend: string | null): string {
  if (!regioneFrontend) return '';
  
  return REGIONI_FRONTEND_TO_DB[regioneFrontend] || regioneFrontend;
}

/**
 * Converte la provincia dal frontend al formato compresso per il database
 * @param {string} provinciaFrontend - Valore dal frontend ("Milano", "Roma", "Napoli")
 * @returns {string} - Valore per database ("MI", "RM", "NA")
 */
export function compressProvinciaEvento(provinciaFrontend: string | null): string {
  if (!provinciaFrontend) return '';
  
  return PROVINCE_FRONTEND_TO_DB[provinciaFrontend] || provinciaFrontend;
}
