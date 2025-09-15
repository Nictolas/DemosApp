// File: api/services/validationService.js
const { pool } = require('../middleware/auth');
const { validators, sanitizers } = require('../middleware/inputValidation');

class ValidationService {
  // Valida email unica
  static async validateUniqueEmail(email, excludeUserId = null) {
    try {
      const emailValidation = validators.email(email);
      if (!emailValidation.isValid) {
        return { isValid: false, error: emailValidation.error };
      }
      const sanitizedEmail = emailValidation.value;
      
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
      
      const cfValidation = validators.codiceFiscale(codiceFiscale);
      if (!cfValidation.isValid) {
        return { isValid: false, error: cfValidation.error };
      }
      const sanitizedCF = cfValidation.value;
      
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
    return validators.codiceFiscale(codiceFiscale);
  }

  // Valida data di nascita
  static validateDataNascita(dataNascita) {
    return validators.dataNascita(dataNascita);
  }

  // Valida password complessità
  static validatePasswordStrength(password) {
    return validators.password(password);
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
              // Per la registrazione, valida solo il formato, non l'unicità
              const emailFormatValidation = validators.email(value);
              if (!emailFormatValidation.isValid) {
                validationErrors.push(emailFormatValidation.error);
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
