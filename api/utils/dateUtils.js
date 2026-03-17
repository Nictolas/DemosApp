/**
 * 🕐 UTILITY PER GESTIONE DATE E FUSO ORARIO ITALIANO - BACKEND
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
const ITALIAN_DATE_OPTIONS = {
  locale: 'it-IT',
  timeZone: ITALIAN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
};

const ITALIAN_DATE_ONLY_OPTIONS = {
  locale: 'it-IT',
  timeZone: ITALIAN_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit'
};

const ITALIAN_TIME_ONLY_OPTIONS = {
  locale: 'it-IT',
  timeZone: ITALIAN_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false
};

/**
 * Formatta una data in formato italiano completo
 * @param {string|Date|number} date - Data da formattare
 * @returns {string} Stringa formattata in italiano (es. "20/09/2025, 14:30:25")
 */
function formatItalianDateTime(date) {
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
 * @param {string|Date|number} date - Data da formattare
 * @returns {string} Stringa formattata in italiano (es. "20/09/2025")
 */
function formatItalianDate(date) {
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
 * @param {string|Date|number} date - Data da formattare
 * @returns {string} Stringa formattata in italiano (es. "14:30:25")
 */
function formatItalianTime(date) {
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
 * @param {string|Date|number} date - Data da formattare
 * @returns {string} Stringa formattata in italiano (es. "2 ore fa", "ieri", "3 giorni fa")
 */
function formatItalianRelativeTime(date) {
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
 * @param {string|Date|number} utcDate - Data UTC
 * @returns {Date} Data nel fuso orario italiano
 */
function convertToItalianTime(utcDate) {
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
 * @returns {Date} Data corrente in fuso orario italiano
 */
function getCurrentItalianTime() {
  return convertToItalianTime(new Date());
}

/**
 * Formatta una data per i log di audit
 * @param {string|Date|number} date - Data da formattare
 * @returns {string} Stringa formattata per i log (es. "20/09/2025, 14:30:25")
 */
function formatAuditLogDate(date) {
  return formatItalianDateTime(date);
}

/**
 * Formatta una data per le notifiche
 * @param {string|Date|number} date - Data da formattare
 * @returns {string} Stringa formattata per le notifiche
 */
function formatNotificationDate(date) {
  return formatItalianRelativeTime(date);
}

/**
 * Verifica se una data è valida
 * @param {string|Date|number} date - Data da verificare
 * @returns {boolean} True se la data è valida
 */
function isValidDate(date) {
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
 * Ottiene il fuso orario italiano corrente
 * @returns {string} Stringa del fuso orario (es. "Europe/Rome")
 */
function getItalianTimezone() {
  return ITALIAN_TIMEZONE;
}

/**
 * Ottiene l'offset del fuso orario italiano rispetto a UTC
 * @returns {number} Offset in minuti (es. 60 per UTC+1, 120 per UTC+2)
 */
function getItalianTimezoneOffset() {
  const now = new Date();
  const utc = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
  const italian = new Date(utc.toLocaleString('en-US', { timeZone: ITALIAN_TIMEZONE }));
  return (italian.getTime() - utc.getTime()) / 60000;
}

/**
 * Formatta una data per le violazioni di sicurezza
 * @param {string|Date|number} date - Data da formattare
 * @returns {string} Stringa formattata per le violazioni
 */
function formatSecurityViolationDate(date) {
  return formatItalianDateTime(date);
}

/**
 * Formatta una data per le metriche di performance
 * @param {string|Date|number} date - Data da formattare
 * @returns {string} Stringa formattata per le metriche
 */
function formatPerformanceMetricDate(date) {
  return formatItalianDateTime(date);
}

module.exports = {
  formatItalianDateTime,
  formatItalianDate,
  formatItalianTime,
  formatItalianRelativeTime,
  convertToItalianTime,
  getCurrentItalianTime,
  formatAuditLogDate,
  formatNotificationDate,
  isValidDate,
  getItalianTimezone,
  getItalianTimezoneOffset,
  formatSecurityViolationDate,
  formatPerformanceMetricDate,
  ITALIAN_TIMEZONE,
  ITALIAN_DATE_OPTIONS,
  ITALIAN_DATE_ONLY_OPTIONS,
  ITALIAN_TIME_ONLY_OPTIONS
};
