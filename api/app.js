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
const rappresentantiRoutes = require('./routes/rappresentanti');
const notificheRoutes = require('./routes/notifiche');
const eventiRoutes = require('./routes/eventi');
const graziaRoutes = require('./routes/grazia');
const amnistiaRoutes = require('./routes/amnistia');
const capoStatoRoutes = require('./routes/capo-stato');
const candidatiRoutes = require('./routes/candidati');
const elezioniRoutes = require('./routes/elezioni');
const iceRoutes = require('./routes/ice');
const iniziativePopolariRoutes = require('./routes/iniziative-popolari');
const referendumRoutes = require('./routes/referendum');
const comunicazioniRoutes = require('./routes/comunicazioni');

const app = express();

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Route di base per evitare errori "Route non trovata"
app.get('/', (req, res) => {
  res.json({ 
    message: 'Demos API Server', 
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

app.head('/', (req, res) => {
  res.status(200).end();
});

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
  
  // Debug specifico per le richieste di registrazione
  if (req.path === '/api/auth/register' && req.method === 'POST') {
    console.log('🚨 DEBUG: Richiesta POST /api/auth/register rilevata!');
    console.log('🚨 DEBUG: Headers:', req.headers);
    console.log('🚨 DEBUG: Body size:', req.body ? Object.keys(req.body).length : 'Nessun body');
  }
  
  // Debug per tutte le richieste POST a /api/auth/*
  if (req.path.startsWith('/api/auth/') && req.method === 'POST') {
    console.log('🔍 DEBUG: Richiesta POST a /api/auth/* rilevata:', req.path);
  }
  
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
app.use('/api/rappresentanti', rappresentantiRoutes);
app.use('/api/notifiche', notificheRoutes);
app.use('/api/eventi', eventiRoutes);
app.use('/api/grazia', graziaRoutes);
app.use('/api/amnistia', amnistiaRoutes);
app.use('/api/capo-stato', capoStatoRoutes);
app.use('/api/candidati', candidatiRoutes);
app.use('/api/elezioni', elezioniRoutes);
app.use('/api/ice', iceRoutes);
app.use('/api/iniziative-popolari', iniziativePopolariRoutes);
app.use('/api/referendum', referendumRoutes);
app.use('/api/comunicazioni', comunicazioniRoutes);

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
  console.log(`📊 Moduli caricati: health, email, database, compatibility, services, auth, users, opinioni, governo, rappresentanti, notifiche`);
});

module.exports = app;
