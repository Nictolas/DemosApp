/**
 * 🕐 UTILITY PER GESTIONE DATE E FUSO ORARIO ITALIANO
 * 
 * Questa utility gestisce correttamente le date e i timestamp
 * utilizzando il fuso orario italiano (UTC+1/UTC+2 con DST)
 */

/**
 * Configurazione fuso orario italiano
 */
const ITALIAN_TIMEZONE = 'Europe/Rome';

/**
 * Opzioni per formattazione date italiane
 */
export const ITALIAN_DATE_OPTIONS = {
  locale: 'it-IT',
  timeZone: ITALIAN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
} as const;

export const ITALIAN_DATE_ONLY_OPTIONS = {
  locale: 'it-IT',
  timeZone: ITALIAN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
} as const;

export const ITALIAN_TIME_ONLY_OPTIONS = {
  locale: 'it-IT',
  timeZone: ITALIAN_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
} as const;

/**
 * Formatta una data in formato italiano completo
 * @param date - Data da formattare (stringa, Date, o timestamp)
 * @returns Stringa formattata in italiano (es. "20/09/2025, 14:30:25")
 */
export function formatItalianDateTime(date: string | Date | number): string {
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Data non valida';
    }
    
    return dateObj.toLocaleString('it-IT', ITALIAN_DATE_OPTIONS);
  } catch (error) {
    console.error('Errore nella formattazione data:', error);
    return 'Data non disponibile';
  }
}

/**
 * Formatta una data in formato italiano (solo data)
 * @param date - Data da formattare
 * @returns Stringa formattata in italiano (es. "20/09/2025")
 */
export function formatItalianDate(date: string | Date | number): string {
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Data non valida';
    }
    
    return dateObj.toLocaleDateString('it-IT', ITALIAN_DATE_ONLY_OPTIONS);
  } catch (error) {
    console.error('Errore nella formattazione data:', error);
    return 'Data non disponibile';
  }
}

/**
 * Formatta un orario in formato italiano (solo ora)
 * @param date - Data da formattare
 * @returns Stringa formattata in italiano (es. "14:30:25")
 */
export function formatItalianTime(date: string | Date | number): string {
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Ora non valida';
    }
    
    return dateObj.toLocaleTimeString('it-IT', ITALIAN_TIME_ONLY_OPTIONS);
  } catch (error) {
    console.error('Errore nella formattazione ora:', error);
    return 'Ora non disponibile';
  }
}

/**
 * Formatta una data in formato relativo italiano
 * @param date - Data da formattare
 * @returns Stringa formattata in italiano (es. "2 ore fa", "ieri", "3 giorni fa")
 */
export function formatItalianRelativeTime(date: string | Date | number): string {
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    if (isNaN(dateObj.getTime())) {
      return 'Data non valida';
    }
    
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'poco fa';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes} minuto${minutes !== 1 ? 'i' : ''} fa`;
    } else if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours} ora${hours !== 1 ? 'e' : ''} fa`;
    } else if (diffInSeconds < 2592000) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days} giorno${days !== 1 ? 'i' : ''} fa`;
    } else {
      return formatItalianDate(dateObj);
    }
  } catch (error) {
    console.error('Errore nella formattazione data relativa:', error);
    return 'Data non disponibile';
  }
}

/**
 * Converte una data UTC in fuso orario italiano
 * @param utcDate - Data UTC
 * @returns Data nel fuso orario italiano
 */
export function convertToItalianTime(utcDate: string | Date | number): Date {
  try {
    const dateObj = typeof utcDate === 'string' || typeof utcDate === 'number' 
      ? new Date(utcDate) 
      : utcDate;
    
    if (isNaN(dateObj.getTime())) {
      throw new Error('Data non valida');
    }
    
    // Crea una nuova data con il fuso orario italiano
    const italianDate = new Date(dateObj.toLocaleString('en-US', { timeZone: ITALIAN_TIMEZONE }));
    return italianDate;
  } catch (error) {
    console.error('Errore nella conversione fuso orario:', error);
    return new Date();
  }
}

/**
 * Ottiene la data e ora corrente in fuso orario italiano
 * @returns Data corrente in fuso orario italiano
 */
export function getCurrentItalianTime(): Date {
  return convertToItalianTime(new Date());
}

/**
 * Formatta una data per i log di audit
 * @param date - Data da formattare
 * @returns Stringa formattata per i log (es. "20/09/2025, 14:30:25")
 */
export function formatAuditLogDate(date: string | Date | number): string {
  return formatItalianDateTime(date);
}

/**
 * Formatta una data per le notifiche
 * @param date - Data da formattare
 * @returns Stringa formattata per le notifiche
 */
export function formatNotificationDate(date: string | Date | number): string {
  return formatItalianRelativeTime(date);
}

/**
 * Verifica se una data è valida
 * @param date - Data da verificare
 * @returns True se la data è valida
 */
export function isValidDate(date: string | Date | number): boolean {
  try {
    const dateObj = typeof date === 'string' || typeof date === 'number' 
      ? new Date(date) 
      : date;
    
    return !isNaN(dateObj.getTime());
  } catch {
    return false;
  }
}

/**
 * Il Ministero usa 9999-12-31 come sentinel per "scadenza non definita".
 */
export function isMinisteroSentinelDate(date: string | Date | number | null | undefined): boolean {
  if (date == null || date === '') return false;

  if (typeof date === 'string') {
    const yearMatch = date.match(/^(\d{4})/);
    if (yearMatch && parseInt(yearMatch[1], 10) >= 9000) return true;
  }

  try {
    const dateObj = typeof date === 'string' || typeof date === 'number'
      ? new Date(date)
      : date;
    if (isNaN(dateObj.getTime())) return false;
    return dateObj.getFullYear() >= 9000;
  } catch {
    return false;
  }
}

/**
 * Restituisce la data solo se è reale (non sentinel Ministero).
 */
export function getDisplayableDate(date: string | Date | number | null | undefined): string | Date | null {
  if (date == null || date === '') return null;
  if (isMinisteroSentinelDate(date)) return null;
  return typeof date === 'number' ? new Date(date) : date;
}

/**
 * Aggiunge N mesi a una data (gestisce overflow del mese).
 */
export function addMonthsToDate(
  date: string | Date | number,
  months: number
): Date | null {
  const d = new Date(date);
  if (isNaN(d.getTime())) return null;
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  // Se il giorno è andato in overflow (es. 31 gen -> 2/3 mar), torna all'ultimo giorno del mese target
  if (d.getDate() < day) {
    d.setDate(0);
  }
  return d;
}

/**
 * Data di fine iniziativa: usa quella presente, altrimenti Data Inizio + 6 mesi.
 */
export function resolveIniziativaDataFine(
  dataFine: string | Date | number | null | undefined,
  dataInizio: string | Date | number | null | undefined
): string | Date | null {
  const fine = getDisplayableDate(dataFine);
  if (fine) return fine;

  const inizio = getDisplayableDate(dataInizio);
  if (!inizio) return null;

  return addMonthsToDate(inizio, 6);
}

/**
 * Ottiene il fuso orario italiano corrente
 * @returns Stringa del fuso orario (es. "Europe/Rome")
 */
export function getItalianTimezone(): string {
  return ITALIAN_TIMEZONE;
}

/**
 * Ottiene l'offset del fuso orario italiano rispetto a UTC
 * @returns Offset in minuti (es. 60 per UTC+1, 120 per UTC+2)
 */
export function getItalianTimezoneOffset(): number {
  const now = new Date();
  const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  const italian = new Date(utc.toLocaleString('en-US', { timeZone: ITALIAN_TIMEZONE }));
  return (italian.getTime() - utc.getTime()) / 60000;
}
