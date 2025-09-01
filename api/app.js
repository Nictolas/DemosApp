const express = require('express');
const cors = require('cors');
const path = require('path');

// Import moduli
const healthRoutes = require('./routes/health');
const emailRoutes = require('./routes/email');
const databaseRoutes = require('./routes/database');
const compatibilityRoutes = require('./routes/compatibility');
const servicesRoutes = require('./routes/services');
const authRoutes = require('./routes/auth/index');
const userRoutes = require('./routes/users/index');
const opinioniRoutes = require('./routes/opinioni/index');
const governoRoutes = require('./routes/governo');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// CORS - Configurazione robusta per produzione
const corsOptions = {
  origin: function (origin, callback) {
    // Permetti richieste senza origin (es. mobile apps, Postman)
    if (!origin) return callback(null, true);
    
    const allowedOrigins = [
      'https://www.demos.community',
      'https://demos.community',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`⚠️  CORS: Origin non autorizzata: ${origin}`);
      callback(null, true); // Temporaneamente permetti tutto per debug
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Length', 'X-Foo', 'X-Bar'],
  optionsSuccessStatus: 200 // Per supportare browser legacy
};

app.use(cors(corsOptions));

// Logging middleware
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${new Date().toISOString()}`);
  console.log(`🌐 Origin: ${req.headers.origin || 'Nessuna'}`);
  console.log(`🔗 Referer: ${req.headers.referer || 'Nessuna'}`);
  next();
});

// Route di base
app.use('/api', healthRoutes);

// Route per email e registrazione
app.use('/api', emailRoutes);

// Route per database
app.use('/api', databaseRoutes);

// Route per compatibilità frontend
app.use('/api', compatibilityRoutes);

// Route per servizi
app.use('/api', servicesRoutes);

// Route modulari
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/opinioni', opinioniRoutes);
app.use('/api/governo', governoRoutes);

// Gestione errori 404
app.use('*', (req, res) => {
  console.log(`❌ Route non trovata: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route non trovata',
    message: `La route ${req.method} ${req.originalUrl} non esiste`
  });
});

// Middleware gestione errori globale
app.use((error, req, res, next) => {
  console.error('💥 Errore globale:', error);
  res.status(500).json({
    success: false,
    error: 'Errore interno del server',
    message: 'Si è verificato un errore imprevisto'
  });
});

const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`🚀 Server avviato sulla porta ${PORT}`);
  console.log(`🌍 Ambiente: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🔗 URL: http://localhost:${PORT}`);
  console.log(`📊 Moduli caricati: health, email, database, compatibility, services, auth, users, opinioni`);
});

module.exports = app;
