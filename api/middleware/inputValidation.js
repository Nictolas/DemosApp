// File: api/middleware/inputValidation.js
// Validazione nativa senza dipendenze esterne

// Funzioni di validazione native
const validators = {
  // Validazione email
  email: (value) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!value || typeof value !== 'string') {
      return { isValid: false, error: 'Email richiesta' };
    }
    if (value.length > 255) {
      return { isValid: false, error: 'Email troppo lunga' };
    }
    if (!emailRegex.test(value)) {
      return { isValid: false, error: 'Email non valida' };
    }
    return { isValid: true, value: value.toLowerCase().trim() };
  },

  // Validazione password
  password: (value) => {
    if (!value || typeof value !== 'string') {
      return { isValid: false, error: 'Password richiesta' };
    }
    if (value.length < 6) {
      return { isValid: false, error: 'Password deve essere almeno 6 caratteri' };
    }
    if (value.length > 128) {
      return { isValid: false, error: 'Password troppo lunga' };
    }
    return { isValid: true, value };
  },

  // Validazione nome/cognome
  name: (value, fieldName = 'Nome') => {
    if (!value || typeof value !== 'string') {
      return { isValid: false, error: `${fieldName} richiesto` };
    }
    if (value.length < 2) {
      return { isValid: false, error: `${fieldName} deve essere almeno 2 caratteri` };
    }
    if (value.length > 50) {
      return { isValid: false, error: `${fieldName} troppo lungo` };
    }
    const nameRegex = /^[a-zA-ZÀ-ÿ\s'-]+$/;
    if (!nameRegex.test(value)) {
      return { isValid: false, error: `${fieldName} può contenere solo lettere, spazi, apostrofi e trattini` };
    }
    return { isValid: true, value: value.trim() };
  },

  // Validazione codice fiscale
  codiceFiscale: (value) => {
    if (!value) {
      return { isValid: true, value: null };
    }
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Codice fiscale deve essere una stringa' };
    }
    const cf = value.toUpperCase().trim();
    if (cf.length !== 16) {
      return { isValid: false, error: 'Codice fiscale deve essere di 16 caratteri' };
    }
    const cfRegex = /^[A-Z0-9]{16}$/;
    if (!cfRegex.test(cf)) {
      return { isValid: false, error: 'Codice fiscale contiene caratteri non validi' };
    }
    return { isValid: true, value: cf };
  },

  // Validazione data di nascita
  dataNascita: (value) => {
    if (!value) {
      return { isValid: true, value: null };
    }
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Data di nascita deve essere una stringa' };
    }
    const dateRegex = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = value.match(dateRegex);
    if (!match) {
      return { isValid: false, error: 'Data di nascita deve essere nel formato DD/MM/YYYY' };
    }
    
    const [, day, month, year] = match;
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    if (yearNum < 1900 || yearNum > new Date().getFullYear()) {
      return { isValid: false, error: 'Anno di nascita non valido' };
    }
    if (monthNum < 1 || monthNum > 12) {
      return { isValid: false, error: 'Mese di nascita non valido' };
    }
    if (dayNum < 1 || dayNum > 31) {
      return { isValid: false, error: 'Giorno di nascita non valido' };
    }
    
    const date = new Date(yearNum, monthNum - 1, dayNum);
    if (date.getDate() !== dayNum || date.getMonth() !== monthNum - 1 || date.getFullYear() !== yearNum) {
      return { isValid: false, error: 'Data di nascita non valida' };
    }
    
    if (date > new Date()) {
      return { isValid: false, error: 'Data di nascita non può essere nel futuro' };
    }
    
    const age = new Date().getFullYear() - yearNum;
    if (age < 13) {
      return { isValid: false, error: 'Devi avere almeno 13 anni per registrarti' };
    }
    
    return { isValid: true, value };
  },

  // Validazione genere
  genere: (value) => {
    if (!value) {
      return { isValid: true, value: null };
    }
    const validGenres = ['u', 'd', 'a'];
    if (!validGenres.includes(value)) {
      return { isValid: false, error: 'Genere deve essere u, d o a' };
    }
    return { isValid: true, value };
  },

  // Validazione opinioni
  opinion: (value) => {
    if (!value) {
      return { isValid: true, value: null };
    }
    const validOpinions = ['f', 'c', 'i'];
    if (!validOpinions.includes(value)) {
      return { isValid: false, error: 'Opinione deve essere f, c o i' };
    }
    return { isValid: true, value };
  },

  // Validazione cittadinanza
  cittadinanza: (value) => {
    if (!value) {
      return { isValid: true, value: null };
    }
    const validCitizenships = ['it', 'st'];
    if (!validCitizenships.includes(value)) {
      return { isValid: false, error: 'Cittadinanza deve essere it o st' };
    }
    return { isValid: true, value };
  },

  // Validazione paese residenza
  paese_residenza: (value) => {
    if (!value) {
      return { isValid: true, value: null };
    }
    const validCountries = ['it', 'st'];
    if (!validCountries.includes(value)) {
      return { isValid: false, error: 'Paese residenza deve essere it o st' };
    }
    return { isValid: true, value };
  },

  // Validazione telefono
  telefono: (value) => {
    if (!value) {
      return { isValid: true, value: null };
    }
    const phoneRegex = /^[\+]?[0-9\s\-\(\)]{7,20}$/;
    if (!phoneRegex.test(value)) {
      return { isValid: false, error: 'Numero di telefono non valido' };
    }
    return { isValid: true, value: value.trim() };
  },

  // Validazione URL
  url: (value) => {
    if (!value) {
      return { isValid: true, value: null };
    }
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return { isValid: false, error: 'URL deve iniziare con http:// o https://' };
      }
      if (value.length > 2048) {
        return { isValid: false, error: 'URL troppo lungo' };
      }
      return { isValid: true, value };
    } catch {
      return { isValid: false, error: 'URL non valido' };
    }
  },

  // Validazione testo generico
  text: (value, maxLength = 10000) => {
    if (!value) {
      return { isValid: true, value: null };
    }
    if (typeof value !== 'string') {
      return { isValid: false, error: 'Testo deve essere una stringa' };
    }
    if (value.length > maxLength) {
      return { isValid: false, error: `Testo troppo lungo (massimo ${maxLength} caratteri)` };
    }
    return { isValid: true, value: value.trim() };
  },

  // Validazione ID
  id: (value) => {
    if (!value || typeof value !== 'string') {
      return { isValid: false, error: 'ID richiesto' };
    }
    if (value.length > 255) {
      return { isValid: false, error: 'ID troppo lungo' };
    }
    const idRegex = /^[a-zA-Z0-9\-_]+$/;
    if (!idRegex.test(value)) {
      return { isValid: false, error: 'ID contiene caratteri non validi' };
    }
    return { isValid: true, value };
  },

  // Validazione numero intero
  integer: (value, min = 0, max = 2147483647) => {
    if (value === undefined || value === null) {
      return { isValid: false, error: 'Numero richiesto' };
    }
    const num = parseInt(value, 10);
    if (isNaN(num)) {
      return { isValid: false, error: 'Deve essere un numero' };
    }
    if (num < min) {
      return { isValid: false, error: `Deve essere maggiore o uguale a ${min}` };
    }
    if (num > max) {
      return { isValid: false, error: `Deve essere minore o uguale a ${max}` };
    }
    return { isValid: true, value: num };
  },

  // Validazione booleano
  boolean: (value) => {
    if (typeof value === 'boolean') {
      return { isValid: true, value };
    }
    if (typeof value === 'string') {
      const lowerValue = value.toLowerCase();
      if (lowerValue === 'true' || lowerValue === '1') {
        return { isValid: true, value: true };
      }
      if (lowerValue === 'false' || lowerValue === '0') {
        return { isValid: true, value: false };
      }
    }
    return { isValid: false, error: 'Deve essere true o false' };
  }
};

// Funzioni di sanitizzazione native
const sanitizers = {
  // Sanitizza HTML (rimuove tag pericolosi)
  html: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/<script[^>]*>.*?<\/script>/gi, '')
      .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '')
      .replace(/<object[^>]*>.*?<\/object>/gi, '')
      .replace(/<embed[^>]*>.*?<\/embed>/gi, '')
      .replace(/<link[^>]*>.*?<\/link>/gi, '')
      .replace(/<meta[^>]*>.*?<\/meta>/gi, '')
      .replace(/<style[^>]*>.*?<\/style>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/onload\s*=/gi, '')
      .replace(/onerror\s*=/gi, '')
      .replace(/onclick\s*=/gi, '')
      .replace(/onmouseover\s*=/gi, '');
  },

  // Sanitizza testo semplice
  text: (input) => {
    if (typeof input !== 'string') return input;
    return input
      .replace(/[<>\"'&]/g, (match) => {
        const escapeMap = {
          '<': '&lt;',
          '>': '&gt;',
          '"': '&quot;',
          "'": '&#x27;',
          '&': '&amp;'
        };
        return escapeMap[match] || match;
      });
  },

  // Sanitizza email
  email: (input) => {
    if (typeof input !== 'string') return input;
    return input.toLowerCase().trim();
  },

  // Sanitizza URL
  url: (input) => {
    if (typeof input !== 'string') return input;
    return input.replace(/[<>\"'&]/g, '');
  },

  // Sanitizza numero
  number: (input) => {
    if (typeof input === 'number') return input;
    if (typeof input === 'string') {
      const num = parseFloat(input);
      return isNaN(num) ? 0 : num;
    }
    return 0;
  },

  // Sanitizza booleano
  boolean: (input) => {
    if (typeof input === 'boolean') return input;
    if (typeof input === 'string') {
      return input.toLowerCase() === 'true' || input === '1';
    }
    return Boolean(input);
  }
};

// Middleware di validazione generico
const validateInput = (rules) => {
  return (req, res, next) => {
    try {
      const errors = [];
      const sanitizedData = {};

      // Valida ogni campo secondo le regole
      for (const [field, rule] of Object.entries(rules)) {
        const value = req.body[field];
        
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors.push({ field, message: `${field} è richiesto` });
          continue;
        }

        if (value !== undefined && value !== null && value !== '') {
          const validator = validators[rule.type];
          if (validator) {
            const result = validator(value, rule.min, rule.max);
            if (!result.isValid) {
              errors.push({ field, message: result.error });
            } else {
              sanitizedData[field] = result.value;
            }
          } else {
            // Se non c'è validatore specifico, sanitizza il testo
            sanitizedData[field] = sanitizers.text(value);
          }
        } else if (!rule.required) {
          sanitizedData[field] = null;
        }
      }

      if (errors.length > 0) {
        console.log('❌ VALIDATION ERROR:', errors);
        return res.status(400).json({
          success: false,
          error: 'Dati di input non validi',
          details: errors
        });
      }

      // Sostituisci req.body con i dati validati e sanitizzati
      req.body = { ...req.body, ...sanitizedData };
      next();
    } catch (err) {
      console.error('❌ Errore validazione input:', err);
      res.status(500).json({
        success: false,
        error: 'Errore interno del server'
      });
    }
  };
};

// Middleware di sanitizzazione
const sanitizeInput = (fields) => {
  return (req, res, next) => {
    try {
      if (fields && Array.isArray(fields)) {
        fields.forEach(field => {
          if (req.body[field] && typeof req.body[field] === 'string') {
            req.body[field] = sanitizers.text(req.body[field]);
          }
        });
      } else {
        // Sanitizza tutti i campi stringa
        Object.keys(req.body).forEach(key => {
          if (typeof req.body[key] === 'string') {
            req.body[key] = sanitizers.text(req.body[key]);
          }
        });
      }
      next();
    } catch (err) {
      console.error('❌ Errore sanitizzazione input:', err);
      res.status(500).json({
        success: false,
        error: 'Errore interno del server'
      });
    }
  };
};

// Validatori specifici per endpoint comuni
const validationRules = {
  // Validazione registrazione utente
  registration: {
    email: { type: 'email', required: true },
    password: { type: 'password', required: true },
    nome: { type: 'name', required: true },
    cognome: { type: 'name', required: true },
    data_nascita: { type: 'dataNascita', required: false },
    genere: { type: 'genere', required: false },
    cittadinanza: { type: 'name', required: false },
    telefono: { type: 'telefono', required: false }
  },

  // Validazione login
  login: {
    email: { type: 'email', required: true },
    password: { type: 'text', required: true }
  },

  // Validazione reset password
  resetPassword: {
    email: { type: 'email', required: true }
  },

  // Validazione nuova password
  newPassword: {
    token: { type: 'text', required: true },
    newPassword: { type: 'password', required: true }
  },

  // Validazione profilo utente
  userProfile: {
    nome: { type: 'name', required: true },
    cognome: { type: 'name', required: true },
    data_nascita: { type: 'dataNascita', required: false },
    genere: { type: 'genere', required: false },
    cittadinanza: { type: 'name', required: false },
    telefono: { type: 'telefono', required: false }
  },

  // Validazione opinioni
  opinion: {
    titolo: { type: 'text', required: true, maxLength: 200 },
    contenuto: { type: 'text', required: true, maxLength: 5000 },
    categoria: { type: 'text', required: true }
  }
};

// Funzione per validare parametri URL
const validateParams = (rules) => {
  return (req, res, next) => {
    try {
      const errors = [];
      const sanitizedParams = {};

      for (const [field, rule] of Object.entries(rules)) {
        const value = req.params[field];
        
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors.push({ field, message: `${field} è richiesto` });
          continue;
        }

        if (value !== undefined && value !== null && value !== '') {
          const validator = validators[rule.type];
          if (validator) {
            const result = validator(value, rule.min, rule.max);
            if (!result.isValid) {
              errors.push({ field, message: result.error });
            } else {
              sanitizedParams[field] = result.value;
            }
          } else {
            sanitizedParams[field] = sanitizers.text(value);
          }
        } else if (!rule.required) {
          sanitizedParams[field] = null;
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Parametri URL non validi',
          details: errors
        });
      }

      req.params = { ...req.params, ...sanitizedParams };
      next();
    } catch (err) {
      console.error('❌ Errore validazione parametri:', err);
      res.status(500).json({
        success: false,
        error: 'Errore interno del server'
      });
    }
  };
};

// Funzione per validare query parameters
const validateQuery = (rules) => {
  return (req, res, next) => {
    try {
      const errors = [];
      const sanitizedQuery = {};

      for (const [field, rule] of Object.entries(rules)) {
        const value = req.query[field];
        
        if (rule.required && (value === undefined || value === null || value === '')) {
          errors.push({ field, message: `${field} è richiesto` });
          continue;
        }

        if (value !== undefined && value !== null && value !== '') {
          const validator = validators[rule.type];
          if (validator) {
            const result = validator(value, rule.min, rule.max);
            if (!result.isValid) {
              errors.push({ field, message: result.error });
            } else {
              sanitizedQuery[field] = result.value;
            }
          } else {
            sanitizedQuery[field] = sanitizers.text(value);
          }
        } else if (!rule.required) {
          sanitizedQuery[field] = null;
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Parametri query non validi',
          details: errors
        });
      }

      req.query = { ...req.query, ...sanitizedQuery };
      next();
    } catch (err) {
      console.error('❌ Errore validazione query:', err);
      res.status(500).json({
        success: false,
        error: 'Errore interno del server'
      });
    }
  };
};

module.exports = {
  validators,
  sanitizers,
  validateInput,
  sanitizeInput,
  validationRules,
  validateParams,
  validateQuery
};