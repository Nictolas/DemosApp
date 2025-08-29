// Middleware per validare gli input delle richieste
const validateInput = (requiredFields) => {
  return (req, res, next) => {
    try {
      const missingFields = [];
      
      // Verifica che tutti i campi richiesti siano presenti
      requiredFields.forEach(field => {
        if (!req.body[field] || req.body[field].toString().trim() === '') {
          missingFields.push(field);
        }
      });
      
      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: 'Campi mancanti o vuoti',
          missingFields: missingFields,
          message: `I seguenti campi sono obbligatori: ${missingFields.join(', ')}`
        });
      }
      
      // Sanitizzazione base degli input
      Object.keys(req.body).forEach(key => {
        if (typeof req.body[key] === 'string') {
          // Rimuovi spazi extra e caratteri pericolosi
          req.body[key] = req.body[key].trim();
          
          // Limita la lunghezza per prevenire attacchi
          if (req.body[key].length > 1000) {
            return res.status(400).json({
              success: false,
              error: 'Input troppo lungo',
              message: `Il campo ${key} non può superare i 1000 caratteri`
            });
          }
        }
      });
      
      console.log('✅ DEBUG - Validazione input completata per:', requiredFields);
      next();
    } catch (error) {
      console.error('❌ Errore nella validazione input:', error);
      res.status(500).json({
        success: false,
        error: 'Errore nella validazione input'
      });
    }
  };
};

// Middleware per validare ID numerici
const validateNumericId = (paramName) => {
  return (req, res, next) => {
    try {
      const id = req.params[paramName];
      
      if (!id || isNaN(parseInt(id))) {
        return res.status(400).json({
          success: false,
          error: 'ID non valido',
          message: `Il parametro ${paramName} deve essere un numero valido`
        });
      }
      
      next();
    } catch (error) {
      console.error('❌ Errore nella validazione ID numerico:', error);
      res.status(500).json({
        success: false,
        error: 'Errore nella validazione ID'
      });
    }
  };
};

// Middleware per validare email
const validateEmail = (req, res, next) => {
  try {
    const { email } = req.body;
    
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          error: 'Email non valida',
          message: 'Inserisci un indirizzo email valido'
        });
      }
    }
    
    next();
  } catch (error) {
    console.error('❌ Errore nella validazione email:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nella validazione email'
    });
  }
};

module.exports = {
  validateInput,
  validateNumericId,
  validateEmail
};
