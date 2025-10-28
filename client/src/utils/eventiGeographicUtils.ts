/**
 * Utilità per la conversione dei dati geografici degli eventi
 * Converte i valori compressi dal database in formato leggibile per l'utente
 */

// Importa le utilità esistenti
const { decompressRegione } = require('../api/utils/regioniUtils');
const { decompressProvince } = require('../api/utils/provinceUtils');

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
  
  return decompressRegione(regioneCompressa) || regioneCompressa;
}

/**
 * Converte la provincia compressa in formato leggibile
 * @param {string} provinciaCompressa - Valore dal database ("MI", "RM", "NA")
 * @returns {string} - Valore per frontend ("Milano", "Roma", "Napoli")
 */
export function decompressProvinciaEvento(provinciaCompressa: string | null): string {
  if (!provinciaCompressa) return '';
  
  return decompressProvince(provinciaCompressa) || provinciaCompressa;
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
 * Formatta solo la regione e provincia per eventi "Elezioni"
 * @param {object} evento - Oggetto evento con dati geografici
 * @returns {string} - Stringa formattata della regione e provincia
 */
export function formatEventoElezioniLocation(evento: {
  regione_evento?: string | null;
  provincia_evento?: string | null;
}): string {
  const regione = decompressRegioneEvento(evento.regione_evento);
  const provincia = decompressProvinciaEvento(evento.provincia_evento);
  
  const parts = [provincia, regione].filter(Boolean);
  return parts.join(', ');
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
  
  // Usa la funzione esistente dalle utilità
  const { compressRegione } = require('../../api/utils/regioniUtils');
  return compressRegione(regioneFrontend) || regioneFrontend;
}

/**
 * Converte la provincia dal frontend al formato compresso per il database
 * @param {string} provinciaFrontend - Valore dal frontend ("Milano", "Roma", "Napoli")
 * @returns {string} - Valore per database ("MI", "RM", "NA")
 */
export function compressProvinciaEvento(provinciaFrontend: string | null): string {
  if (!provinciaFrontend) return '';
  
  // Usa la funzione esistente dalle utilità
  const { compressProvince } = require('../../api/utils/provinceUtils');
  return compressProvince(provinciaFrontend) || provinciaFrontend;
}
