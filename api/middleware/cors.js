const cors = require('cors');

// Configurazione CORS per produzione
const corsOptions = {
  origin: function (origin, callback) {
    // Permetti richieste senza origin (es. Postman, curl, server-to-server)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://127.0.0.1:3000', 
      'https://www.demos.community',
      'https://demos.community',
      'https://demos-frontend-r3so.onrender.com',
      'https://demos-frontend.onrender.com',
      'https://demos-app.onrender.com',
      'https://*.onrender.com'
    ];
    
    // Log per debug
    console.log('🌐 CORS check - Origin:', origin);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('✅ CORS allowed origin:', origin);
      callback(null, true);
    } else {
      console.log('🚫 CORS blocked origin:', origin);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Origin', 'Accept', 'X-Requested-With', 'Cache-Control', 'Pragma'],
  preflightContinue: false,
  optionsSuccessStatus: 204,
  maxAge: 86400 // Cache preflight per 24 ore
};

// Middleware CORS principale
const corsMiddleware = cors(corsOptions);

// Middleware per gestire CORS preflight
const corsPreflight = (req, res, next) => {
  const origin = req.headers.origin;
  
  // Log per debug
  if (req.method === 'OPTIONS') {
    console.log('🔄 OPTIONS request handled by middleware');
  }
  
  // Imposta sempre gli header CORS per le richieste effettive
  if (origin) {
    const allowedOrigins = [
      'http://localhost:3000', 
      'http://127.0.0.1:3000', 
      'https://www.demos.community',
      'https://demos.community',
      'https://demos-frontend-r3so.onrender.com',
      'https://demos-frontend.onrender.com',
      'https://demos-app.onrender.com',
      'https://*.onrender.com'
    ];
    
    if (allowedOrigins.includes(origin)) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      res.header('Access-Control-Allow-Credentials', 'true');
      res.header('Access-Control-Max-Age', '86400');
    }
  }
  
  next();
};

module.exports = {
  corsMiddleware,
  corsPreflight
};
