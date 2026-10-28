// Input validation shared by authenticated routes. Never log request bodies,
// email addresses or other user-provided fields.
const validateInput = (requiredFields) => (req, res, next) => {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return res.status(400).json({success:false,error:'Corpo della richiesta non valido'});
    }
    const missingFields = requiredFields.filter(field => {
      const value = body[field];
      return value === undefined || value === null ||
        (typeof value === 'string' && value.trim() === '') ||
        (Array.isArray(value) && value.length === 0);
    });
    if (missingFields.length > 0) {
      return res.status(400).json({
        success:false,error:'Campi mancanti o vuoti',missingFields,
        message:`I seguenti campi sono obbligatori: ${missingFields.join(', ')}`
      });
    }
    // Use a loop rather than forEach: a 400 must stop before next().
    for (const [key, value] of Object.entries(body)) {
      if (typeof value !== 'string') continue;
      const trimmed = value.trim();
      if (trimmed.length > 1000) {
        return res.status(400).json({
          success:false,error:'Input troppo lungo',
          message:`Il campo ${key} non può superare i 1000 caratteri`
        });
      }
      body[key] = trimmed;
    }
    return next();
  } catch (_) {
    console.error('INPUT_VALIDATION_FAILED');
    return res.status(500).json({success:false,error:'Errore nella validazione input'});
  }
};

const validateNumericId = (paramName) => (req, res, next) => {
  try {
    const id = req.params?.[paramName];
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({
        success:false,error:'ID non valido',
        message:`Il parametro ${paramName} deve essere un numero valido`
      });
    }
    return next();
  } catch (_) {
    console.error('NUMERIC_ID_VALIDATION_FAILED');
    return res.status(500).json({success:false,error:'Errore nella validazione ID'});
  }
};

const validateEmail = (req, res, next) => {
  try {
    const email = req.body?.email;
    if (email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (typeof email !== 'string' || !emailRegex.test(email)) {
        return res.status(400).json({
          success:false,error:'Email non valida',
          message:'Inserisci un indirizzo email valido'
        });
      }
    }
    return next();
  } catch (_) {
    console.error('EMAIL_VALIDATION_FAILED');
    return res.status(500).json({success:false,error:'Errore nella validazione email'});
  }
};

module.exports = {validateInput, validateNumericId, validateEmail};
