// File: api/middleware/rateLimiting.js
const rateLimit = require('express-rate-limit');

// Configurazione generale per tutte le API
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 500, // 500 richieste per IP per finestra (ridotto da 10000 ma aumentato per evitare 429)
  // Gestisci proxy in modo più sicuro
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
  // Escludi localhost in sviluppo
  skip: (req) => {
    const isLocalhost = req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev';
    return isLocalhost && isDevelopment;
  },
  message: {
    success: false,
    error: 'Troppe richieste',
    message: 'Hai superato il limite di richieste. Riprova tra 15 minuti.',
    retryAfter: 15 * 60 // secondi
  },
  standardHeaders: true, // Restituisce rate limit info negli headers
  legacyHeaders: false, // Disabilita X-RateLimit-* headers
  handler: (req, res) => {
    console.log(`🚨 RATE LIMIT: IP ${req.ip} ha superato il limite generale`);
    res.status(429).json({
      success: false,
      error: 'Troppe richieste',
      message: 'Hai superato il limite di richieste. Riprova tra 15 minuti.',
      retryAfter: 15 * 60
    });
  }
});

// Rate limiting per autenticazione (più restrittivo)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 20, // 20 tentativi di login per IP (aumentato per evitare blocchi)
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
  // Escludi localhost in sviluppo
  skip: (req) => {
    const isLocalhost = req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev';
    return isLocalhost && isDevelopment;
  },
  message: {
    success: false,
    error: 'Troppi tentativi di accesso',
    message: 'Hai superato il limite di tentativi di accesso. Riprova tra 15 minuti.',
    retryAfter: 15 * 60
  },
  skipSuccessfulRequests: true, // Non conta i login riusciti
  onLimitReached: (req, res, options) => {
    console.log(`🚨 AUTH RATE LIMIT REACHED: IP ${req.ip} ha raggiunto il limite di autenticazione`);
  },
  handler: (req, res) => {
    console.log(`🚨 AUTH RATE LIMIT: IP ${req.ip} ha superato il limite di autenticazione`);
    res.status(429).json({
      success: false,
      error: 'Troppi tentativi di accesso',
      message: 'Hai superato il limite di tentativi di accesso. Riprova tra 15 minuti.',
      retryAfter: 15 * 60
    });
  }
});

// Rate limiting per registrazione (molto restrittivo)
const registrationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3, // Solo 3 registrazioni per IP all'ora
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
  message: {
    success: false,
    error: 'Troppe registrazioni',
    message: 'Hai superato il limite di registrazioni. Riprova tra 1 ora.',
    retryAfter: 60 * 60
  },
  handler: (req, res) => {
    console.log(`🚨 REGISTRATION RATE LIMIT: IP ${req.ip} ha superato il limite di registrazione`);
    res.status(429).json({
      success: false,
      error: 'Troppe registrazioni',
      message: 'Hai superato il limite di registrazioni. Riprova tra 1 ora.',
      retryAfter: 60 * 60
    });
  }
});

// Rate limiting per password reset (molto restrittivo)
const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 3, // Solo 3 richieste di reset per IP all'ora
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
  message: {
    success: false,
    error: 'Troppe richieste di reset password',
    message: 'Hai superato il limite di richieste di reset. Riprova tra 1 ora.',
    retryAfter: 60 * 60
  },
  handler: (req, res) => {
    console.log(`🚨 PASSWORD RESET RATE LIMIT: IP ${req.ip} ha superato il limite di reset password`);
    res.status(429).json({
      success: false,
      error: 'Troppe richieste di reset password',
      message: 'Hai superato il limite di richieste di reset. Riprova tra 1 ora.',
      retryAfter: 60 * 60
    });
  }
});

// Rate limiting per API admin (moderato)
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 200, // 200 richieste per admin per finestra
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
  message: {
    success: false,
    error: 'Limite admin superato',
    message: 'Hai superato il limite di richieste admin. Riprova tra 15 minuti.',
    retryAfter: 15 * 60
  },
  handler: (req, res) => {
    console.log(`🚨 ADMIN RATE LIMIT: Admin ${req.userId} ha superato il limite admin`);
    res.status(429).json({
      success: false,
      error: 'Limite admin superato',
      message: 'Hai superato il limite di richieste admin. Riprova tra 15 minuti.',
      retryAfter: 15 * 60
    });
  }
});

// Rate limiting per API utente (moderato)
const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 200, // 200 richieste per utente per finestra (aumentato da 50)
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
  message: {
    success: false,
    error: 'Limite utente superato',
    message: 'Hai superato il limite di richieste utente. Riprova tra 15 minuti.',
    retryAfter: 15 * 60
  },
  handler: (req, res) => {
    console.log(`🚨 USER RATE LIMIT: Utente ${req.userId} ha superato il limite utente`);
    res.status(429).json({
      success: false,
      error: 'Limite utente superato',
      message: 'Hai superato il limite di richieste utente. Riprova tra 15 minuti.',
      retryAfter: 15 * 60
    });
  }
});

// Rate limiting per richieste sospette (sostituisce slow-down)
const speedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 50, // Limite più basso per richieste sospette
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
  // Escludi localhost e IP di sviluppo
  skip: (req) => {
    const isLocalhost = req.ip === '::1' || req.ip === '127.0.0.1' || req.ip === '::ffff:127.0.0.1';
    const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'dev';
    return isLocalhost && isDevelopment;
  },
  message: {
    success: false,
    error: 'Troppe richieste sospette',
    message: 'Hai superato il limite di richieste. Riprova tra 15 minuti.',
    retryAfter: 15 * 60
  },
  handler: (req, res) => {
    console.log(`🐌 SPEED LIMIT: IP ${req.ip} sta facendo troppe richieste sospette`);
    res.status(429).json({
      success: false,
      error: 'Troppe richieste sospette',
      message: 'Hai superato il limite di richieste. Riprova tra 15 minuti.',
      retryAfter: 15 * 60
    });
  }
});

// Rate limiting per upload file
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 ora
  max: 10, // Solo 10 upload per IP all'ora
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
  message: {
    success: false,
    error: 'Limite upload superato',
    message: 'Hai superato il limite di upload. Riprova tra 1 ora.',
    retryAfter: 60 * 60
  },
  handler: (req, res) => {
    console.log(`🚨 UPLOAD RATE LIMIT: IP ${req.ip} ha superato il limite di upload`);
    res.status(429).json({
      success: false,
      error: 'Limite upload superato',
      message: 'Hai superato il limite di upload. Riprova tra 1 ora.',
      retryAfter: 60 * 60
    });
  }
});

// Rate limiting per API pubbliche (meno restrittivo)
const publicLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 30, // 30 richieste per IP per finestra
  trustProxy: process.env.NODE_ENV === 'production' ? 1 : false,
  message: {
    success: false,
    error: 'Limite API pubblica superato',
    message: 'Hai superato il limite di richieste API pubbliche. Riprova tra 15 minuti.',
    retryAfter: 15 * 60
  },
  handler: (req, res) => {
    console.log(`🚨 PUBLIC API RATE LIMIT: IP ${req.ip} ha superato il limite API pubbliche`);
    res.status(429).json({
      success: false,
      error: 'Limite API pubblica superato',
      message: 'Hai superato il limite di richieste API pubbliche. Riprova tra 15 minuti.',
      retryAfter: 15 * 60
    });
  }
});

module.exports = {
  generalLimiter,
  authLimiter,
  registrationLimiter,
  passwordResetLimiter,
  adminLimiter,
  userLimiter,
  speedLimiter,
  uploadLimiter,
  publicLimiter
};
