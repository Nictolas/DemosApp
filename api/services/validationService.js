// File: api/services/validationService.js
const { pool } = require('../middleware/auth');
const { sanitizers } = require('../middleware/inputValidation');

class ValidationService {
  // Valida email unica
  static async validateUniqueEmail(email, excludeUserId = null) {
    try {
      const sanitizedEmail = sanitizers.email(email);
      
      let query = 'SELECT id FROM users WHERE email = $1';
      const params = [sanitizedEmail];
      
      if (excludeUserId) {
        query += ' AND id != $2';
        params.push(excludeUserId);
      }
      
      const result = await pool.query(query, params);
      
      if (result.rows.length > 0) {
        return {
          isValid: false,
          error: 'Email già utilizzata'
        };
      }
      
      return {
        isValid: true,
        sanitizedEmail
      };
    } catch (error) {
      console.error('❌ Errore validazione email unica:', error);
      return {
        isValid: false,
        error: 'Errore interno del server'
      };
    }
  }

  // Valida codice fiscale unico
  static async validateUniqueCodiceFiscale(codiceFiscale, excludeUserId = null) {
    try {
      if (!codiceFiscale) {
        return { isValid: true };
      }
      
      const sanitizedCF = codiceFiscale.toUpperCase().trim();
      
      let query = 'SELECT id FROM users WHERE codice_fiscale = $1';
      const params = [sanitizedCF];
      
      if (excludeUserId) {
        query += ' AND id != $2';
        params.push(excludeUserId);
      }
      
      const result = await pool.query(query, params);
      
      if (result.rows.length > 0) {
        return {
          isValid: false,
          error: 'Codice fiscale già utilizzato'
        };
      }
      
      return {
        isValid: true,
        sanitizedCF
      };
    } catch (error) {
      console.error('❌ Errore validazione codice fiscale unico:', error);
      return {
        isValid: false,
        error: 'Errore interno del server'
      };
    }
  }

  // Valida formato codice fiscale italiano
  static validateCodiceFiscaleFormat(codiceFiscale) {
    if (!codiceFiscale) {
      return { isValid: true };
    }
    
    const cf = codiceFiscale.toUpperCase().trim();
    
    // Controlla lunghezza
    if (cf.length !== 16) {
      return {
        isValid: false,
        error: 'Codice fiscale deve essere di 16 caratteri'
      };
    }
    
    // Controlla formato
    const cfPattern = /^[A-Z0-9]{16}$/;
    if (!cfPattern.test(cf)) {
      return {
        isValid: false,
        error: 'Codice fiscale contiene caratteri non validi'
      };
    }
    
    // Controlla posizioni specifiche
    const nome = cf.substring(3, 6);
    const cognome = cf.substring(0, 3);
    const data = cf.substring(6, 11);
    const comune = cf.substring(11, 15);
    const controllo = cf.substring(15, 16);
    
    // Controlla che nome e cognome siano lettere
    if (!/^[A-Z]{3}$/.test(nome) || !/^[A-Z]{3}$/.test(cognome)) {
      return {
        isValid: false,
        error: 'Codice fiscale: nome e cognome devono essere lettere'
      };
    }
    
    // Controlla formato data
    if (!/^[0-9]{2}[A-Z][0-9]{2}$/.test(data)) {
      return {
        isValid: false,
        error: 'Codice fiscale: formato data non valido'
      };
    }
    
    // Controlla che comune sia alfanumerico
    if (!/^[A-Z0-9]{4}$/.test(comune)) {
      return {
        isValid: false,
        error: 'Codice fiscale: formato comune non valido'
      };
    }
    
    // Controlla che controllo sia alfanumerico
    if (!/^[A-Z0-9]$/.test(controllo)) {
      return {
        isValid: false,
        error: 'Codice fiscale: carattere di controllo non valido'
      };
    }
    
    return {
      isValid: true,
      sanitizedCF: cf
    };
  }

  // Valida data di nascita
  static validateDataNascita(dataNascita) {
    if (!dataNascita) {
      return { isValid: true };
    }
    
    // Controlla formato DD/MM/YYYY
    const datePattern = /^(\d{2})\/(\d{2})\/(\d{4})$/;
    const match = dataNascita.match(datePattern);
    
    if (!match) {
      return {
        isValid: false,
        error: 'Data di nascita deve essere nel formato DD/MM/YYYY'
      };
    }
    
    const [, day, month, year] = match;
    const dayNum = parseInt(day, 10);
    const monthNum = parseInt(month, 10);
    const yearNum = parseInt(year, 10);
    
    // Controlla range anni
    const currentYear = new Date().getFullYear();
    if (yearNum < 1900 || yearNum > currentYear) {
      return {
        isValid: false,
        error: 'Anno di nascita non valido'
      };
    }
    
    // Controlla range mesi
    if (monthNum < 1 || monthNum > 12) {
      return {
        isValid: false,
        error: 'Mese di nascita non valido'
      };
    }
    
    // Controlla range giorni
    if (dayNum < 1 || dayNum > 31) {
      return {
        isValid: false,
        error: 'Giorno di nascita non valido'
      };
    }
    
    // Controlla se la data è valida
    const date = new Date(yearNum, monthNum - 1, dayNum);
    if (date.getDate() !== dayNum || date.getMonth() !== monthNum - 1 || date.getFullYear() !== yearNum) {
      return {
        isValid: false,
        error: 'Data di nascita non valida'
      };
    }
    
    // Controlla se la data non è nel futuro
    if (date > new Date()) {
      return {
        isValid: false,
        error: 'Data di nascita non può essere nel futuro'
      };
    }
    
    // Controlla età minima (13 anni)
    const age = currentYear - yearNum;
    if (age < 13) {
      return {
        isValid: false,
        error: 'Devi avere almeno 13 anni per registrarti'
      };
    }
    
    return {
      isValid: true,
      sanitizedDate: dataNascita
    };
  }

  // Valida password complessità
  static validatePasswordStrength(password) {
    if (!password) {
      return {
        isValid: false,
        error: 'Password richiesta'
      };
    }
    
    const errors = [];
    
    // Controlla lunghezza minima
    if (password.length < 8) {
      errors.push('Password deve essere almeno 8 caratteri');
    }
    
    // Controlla lunghezza massima
    if (password.length > 128) {
      errors.push('Password troppo lunga (massimo 128 caratteri)');
    }
    
    // Controlla caratteri obbligatori
    if (!/[a-z]/.test(password)) {
      errors.push('Password deve contenere almeno una lettera minuscola');
    }
    
    if (!/[A-Z]/.test(password)) {
      errors.push('Password deve contenere almeno una lettera maiuscola');
    }
    
    if (!/[0-9]/.test(password)) {
      errors.push('Password deve contenere almeno un numero');
    }
    
    if (!/[@$!%*?&]/.test(password)) {
      errors.push('Password deve contenere almeno un carattere speciale (@$!%*?&)');
    }
    
    // Controlla caratteri non consentiti
    if (/[<>\"'&]/.test(password)) {
      errors.push('Password non può contenere caratteri HTML');
    }
    
    // Controlla sequenze comuni
    const commonSequences = [
      '123456',
      'password',
      'qwerty',
      'abc123',
      'admin',
      'user',
      'test'
    ];
    
    const lowerPassword = password.toLowerCase();
    for (const sequence of commonSequences) {
      if (lowerPassword.includes(sequence)) {
        errors.push('Password troppo comune o prevedibile');
        break;
      }
    }
    
    if (errors.length > 0) {
      return {
        isValid: false,
        errors
      };
    }
    
    return {
      isValid: true
    };
  }

  // Sanitizza input completo
  static sanitizeInput(input) {
    if (typeof input === 'string') {
      return sanitizers.text(input);
    }
    
    if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
    }
    
    if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }
    
    return input;
  }

  // Valida e sanitizza input completo
  static async validateAndSanitizeInput(input, validationRules) {
    try {
      const sanitizedInput = this.sanitizeInput(input);
      const validationErrors = [];
      
      // Applica regole di validazione
      for (const [field, rules] of Object.entries(validationRules)) {
        const value = sanitizedInput[field];
        
        if (rules.required && (!value || value === '')) {
          validationErrors.push(`${field} è richiesto`);
          continue;
        }
        
        if (value && rules.type) {
          switch (rules.type) {
            case 'email':
              const emailValidation = await this.validateUniqueEmail(value);
              if (!emailValidation.isValid) {
                validationErrors.push(emailValidation.error);
              }
              break;
              
            case 'codiceFiscale':
              const cfValidation = this.validateCodiceFiscaleFormat(value);
              if (!cfValidation.isValid) {
                validationErrors.push(cfValidation.error);
              }
              break;
              
            case 'dataNascita':
              const dateValidation = this.validateDataNascita(value);
              if (!dateValidation.isValid) {
                validationErrors.push(dateValidation.error);
              }
              break;
              
            case 'password':
              const passwordValidation = this.validatePasswordStrength(value);
              if (!passwordValidation.isValid) {
                if (passwordValidation.errors) {
                  validationErrors.push(...passwordValidation.errors);
                } else {
                  validationErrors.push(passwordValidation.error);
                }
              }
              break;
          }
        }
      }
      
      if (validationErrors.length > 0) {
        return {
          isValid: false,
          errors: validationErrors,
          sanitizedInput
        };
      }
      
      return {
        isValid: true,
        sanitizedInput
      };
    } catch (error) {
      console.error('❌ Errore validazione e sanitizzazione:', error);
      return {
        isValid: false,
        errors: ['Errore interno del server'],
        sanitizedInput: input
      };
    }
  }

  // Log tentativi di validazione falliti
  static async logValidationFailure(ip, userAgent, endpoint, errors, input) {
    try {
      const query = `
        INSERT INTO validation_failures (
          ip_address,
          user_agent,
          endpoint,
          errors,
          input_data,
          timestamp
        ) VALUES ($1, $2, $3, $4, $5, NOW())
      `;
      
      await pool.query(query, [
        ip,
        userAgent,
        endpoint,
        JSON.stringify(errors),
        JSON.stringify(input)
      ]);
      
      console.log(`📊 VALIDATION FAILURE LOGGED: ${ip} - ${endpoint} - ${errors.length} errors`);
    } catch (error) {
      console.error('❌ Errore nel logging validazione fallita:', error);
    }
  }
}

module.exports = ValidationService;
