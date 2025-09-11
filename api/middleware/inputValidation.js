// File: api/middleware/inputValidation.js
const Joi = require('joi');
const validator = require('validator');
const xss = require('xss');
const sanitizeHtml = require('sanitize-html');

// Schemi di validazione per diversi tipi di input
const validationSchemas = {
  // Validazione email
  email: Joi.string()
    .email({ minDomainSegments: 2, tlds: { allow: ['com', 'it', 'org', 'net', 'eu'] } })
    .max(255)
    .required()
    .messages({
      'string.email': 'Email non valida',
      'string.max': 'Email troppo lunga',
      'any.required': 'Email richiesta'
    }),

  // Validazione password
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
    .required()
    .messages({
      'string.min': 'Password deve essere almeno 8 caratteri',
      'string.max': 'Password troppo lunga',
      'string.pattern.base': 'Password deve contenere: maiuscola, minuscola, numero e carattere speciale',
      'any.required': 'Password richiesta'
    }),

  // Validazione nome
  nome: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .required()
    .messages({
      'string.min': 'Nome deve essere almeno 2 caratteri',
      'string.max': 'Nome troppo lungo',
      'string.pattern.base': 'Nome può contenere solo lettere, spazi, apostrofi e trattini',
      'any.required': 'Nome richiesto'
    }),

  // Validazione cognome
  cognome: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .required()
    .messages({
      'string.min': 'Cognome deve essere almeno 2 caratteri',
      'string.max': 'Cognome troppo lungo',
      'string.pattern.base': 'Cognome può contenere solo lettere, spazi, apostrofi e trattini',
      'any.required': 'Cognome richiesto'
    }),

  // Validazione codice fiscale
  codiceFiscale: Joi.string()
    .length(16)
    .pattern(/^[A-Z0-9]{16}$/)
    .optional()
    .messages({
      'string.length': 'Codice fiscale deve essere di 16 caratteri',
      'string.pattern.base': 'Codice fiscale non valido'
    }),

  // Validazione data di nascita
  dataNascita: Joi.string()
    .pattern(/^\d{2}\/\d{2}\/\d{4}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Data di nascita deve essere nel formato DD/MM/YYYY'
    }),

  // Validazione genere
  genere: Joi.string()
    .valid('M', 'F', 'Altro')
    .optional()
    .messages({
      'any.only': 'Genere deve essere M, F o Altro'
    }),

  // Validazione cittadinanza
  cittadinanza: Joi.string()
    .min(2)
    .max(50)
    .pattern(/^[a-zA-ZÀ-ÿ\s'-]+$/)
    .optional()
    .messages({
      'string.min': 'Cittadinanza deve essere almeno 2 caratteri',
      'string.max': 'Cittadinanza troppo lunga',
      'string.pattern.base': 'Cittadinanza può contenere solo lettere, spazi, apostrofi e trattini'
    }),

  // Validazione telefono
  telefono: Joi.string()
    .pattern(/^[\+]?[0-9\s\-\(\)]{7,20}$/)
    .optional()
    .messages({
      'string.pattern.base': 'Numero di telefono non valido'
    }),

  // Validazione URL
  url: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .max(2048)
    .optional()
    .messages({
      'string.uri': 'URL non valido',
      'string.max': 'URL troppo lungo'
    }),

  // Validazione testo generico
  testo: Joi.string()
    .max(10000)
    .optional()
    .messages({
      'string.max': 'Testo troppo lungo'
    }),

  // Validazione ID
  id: Joi.string()
    .pattern(/^[a-zA-Z0-9\-_]+$/)
    .max(255)
    .required()
    .messages({
      'string.pattern.base': 'ID non valido',
      'string.max': 'ID troppo lungo',
      'any.required': 'ID richiesto'
    }),

  // Validazione UUID
  uuid: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'UUID non valido',
      'any.required': 'UUID richiesto'
    }),

  // Validazione numero intero
  integer: Joi.number()
    .integer()
    .min(0)
    .max(2147483647)
    .required()
    .messages({
      'number.base': 'Deve essere un numero',
      'number.integer': 'Deve essere un numero intero',
      'number.min': 'Deve essere maggiore o uguale a 0',
      'number.max': 'Numero troppo grande',
      'any.required': 'Numero richiesto'
    }),

  // Validazione booleano
  boolean: Joi.boolean()
    .required()
    .messages({
      'boolean.base': 'Deve essere true o false',
      'any.required': 'Valore booleano richiesto'
    })
};

// Funzioni di sanitizzazione
const sanitizers = {
  // Sanitizza HTML
  html: (input) => {
    if (typeof input !== 'string') return input;
    return sanitizeHtml(input, {
      allowedTags: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
      allowedAttributes: {},
      disallowedTagsMode: 'discard'
    });
  },

  // Sanitizza testo semplice
  text: (input) => {
    if (typeof input !== 'string') return input;
    return xss(input, {
      whiteList: {},
      stripIgnoreTag: true,
      stripIgnoreTagBody: ['script']
    });
  },

  // Sanitizza email
  email: (input) => {
    if (typeof input !== 'string') return input;
    return validator.normalizeEmail(input, { gmail_remove_dots: false });
  },

  // Sanitizza URL
  url: (input) => {
    if (typeof input !== 'string') return input;
    return validator.escape(input);
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
const validateInput = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.body, { 
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });

      if (error) {
        const errorMessages = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        console.log('❌ VALIDATION ERROR:', errorMessages);
        
        return res.status(400).json({
          success: false,
          error: 'Dati di input non validi',
          details: errorMessages
        });
      }

      // Sostituisci req.body con i dati validati
      req.body = value;
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
const validators = {
  // Validazione registrazione utente
  registration: Joi.object({
    email: validationSchemas.email,
    password: validationSchemas.password,
    nome: validationSchemas.nome,
    cognome: validationSchemas.cognome,
    data_nascita: validationSchemas.dataNascita,
    genere: validationSchemas.genere,
    cittadinanza: validationSchemas.cittadinanza,
    codice_fiscale: validationSchemas.codiceFiscale,
    telefono: validationSchemas.telefono
  }),

  // Validazione login
  login: Joi.object({
    email: validationSchemas.email,
    password: Joi.string().required().messages({
      'any.required': 'Password richiesta'
    })
  }),

  // Validazione reset password
  resetPassword: Joi.object({
    email: validationSchemas.email
  }),

  // Validazione nuova password
  newPassword: Joi.object({
    token: Joi.string().required().messages({
      'any.required': 'Token richiesto'
    }),
    newPassword: validationSchemas.password
  }),

  // Validazione profilo utente
  userProfile: Joi.object({
    nome: validationSchemas.nome,
    cognome: validationSchemas.cognome,
    data_nascita: validationSchemas.dataNascita,
    genere: validationSchemas.genere,
    cittadinanza: validationSchemas.cittadinanza,
    telefono: validationSchemas.telefono
  }),

  // Validazione opinioni
  opinion: Joi.object({
    titolo: Joi.string().min(5).max(200).required().messages({
      'string.min': 'Titolo deve essere almeno 5 caratteri',
      'string.max': 'Titolo troppo lungo',
      'any.required': 'Titolo richiesto'
    }),
    contenuto: Joi.string().min(10).max(5000).required().messages({
      'string.min': 'Contenuto deve essere almeno 10 caratteri',
      'string.max': 'Contenuto troppo lungo',
      'any.required': 'Contenuto richiesto'
    }),
    categoria: Joi.string().valid('politica', 'economia', 'sociale', 'ambiente', 'altro').required().messages({
      'any.only': 'Categoria non valida',
      'any.required': 'Categoria richiesta'
    })
  }),

  // Validazione parametri URL
  urlParams: Joi.object({
    id: validationSchemas.id,
    page: Joi.number().integer().min(1).max(1000).optional(),
    limit: Joi.number().integer().min(1).max(100).optional(),
    sort: Joi.string().valid('asc', 'desc').optional(),
    search: Joi.string().max(100).optional()
  })
};

// Funzione per validare parametri URL
const validateParams = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.params, { 
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errorMessages = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return res.status(400).json({
          success: false,
          error: 'Parametri URL non validi',
          details: errorMessages
        });
      }

      req.params = value;
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
const validateQuery = (schema) => {
  return (req, res, next) => {
    try {
      const { error, value } = schema.validate(req.query, { 
        abortEarly: false,
        stripUnknown: true
      });

      if (error) {
        const errorMessages = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }));

        return res.status(400).json({
          success: false,
          error: 'Parametri query non validi',
          details: errorMessages
        });
      }

      req.query = value;
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
  validationSchemas,
  sanitizers,
  validateInput,
  sanitizeInput,
  validators,
  validateParams,
  validateQuery
};
