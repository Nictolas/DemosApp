const express = require('express');
const cors = require('cors');
const path = require('path');
const { securityHeaders, securityMiddleware, securityLogger } = require('./middleware/security');
const { requestLoggingMiddleware, errorLoggingMiddleware } = require('./middleware/loggingMiddleware');
const logger = require('./services/centralizedLogger');

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
const governoMinistroRoutes = require('./routes/governo-ministro');
const rappresentantiRoutes = require('./routes/rappresentanti');
const notificheRoutes = require('./routes/notifiche');
const testDbRoutes = require('./routes/test-db');
const eventiRoutes = require('./routes/eventi');
const graziaRoutes = require('./routes/grazia');
const amnistiaRoutes = require('./routes/amnistia');
const capoStatoRoutes = require('./routes/capo-stato');
const elezioniRoutes = require('./routes/elezioni');
const iceRoutes = require('./routes/ice');
const iniziativePopolariRoutes = require('./routes/iniziative-popolari');
const referendumRoutes = require('./routes/referendum');
const comunicazioniRoutes = require('./routes/comunicazioni');
const reazioniComunicazioniRoutes = require('./routes/reazioni-comunicazioni');
const sostenitoriRoutes = require('./routes/sostenitori');
const sostenitoriTotaleRoutes = require('./routes/sostenitori-totale');
const rappresentantiSostenitoriRoutes = require('./routes/rappresentanti-sostenitori');
const candidatiSostenitoriRoutes = require('./routes/candidati-sostenitori');
const sondaggiRoutes = require('./routes/sondaggi');
const adminRoutes = require('./routes/admin/database');
const testRoutes = require('./routes/test');
const gdprRightsRoutes = require('./routes/user/gdpr-rights');
const gdprRequestsRoutes = require('./routes/user/gdpr-requests');
const downloadDataRoutes = require('./routes/user/download-data');
const deleteAccountRoutes = require('./routes/user/delete-account');
const privacySettingsRoutes = require('./routes/user/privacy-settings');
const auditDashboardRoutes = require('./routes/admin/audit-dashboard');
const dataRetentionRoutes = require('./routes/admin/data-retention');
const violationRoutes = require('./routes/admin/violations');
const backupRoutes = require('./routes/admin/backup');
const rateLimitingRoutes = require('./routes/admin/rate-limiting');
const validationRoutes = require('./routes/admin/validation');
const loggingRoutes = require('./routes/admin/logging');
const monitoringRoutes = require('./routes/admin/monitoring');
const cleanupRoutes = require('./routes/cleanup');
const cleanupRateLimitRoutes = require('./routes/cleanup-reset-rate-limit');
const segnalazioniRoutes = require('./routes/segnalazioni');
const programmaRoutes = require('./routes/programma');
// const { startAuditJobs } = require('./jobs/auditCleanup'); // Disabilitato per il deploy
const auditManager = require('./services/auditManager');
const dataRetentionJob = require('./jobs/dataRetentionJob');
const violationMonitoringJob = require('./jobs/violationMonitoringJob');
const backupJob = require('./jobs/backupJob');

// Import rate limiting middleware
const {
  generalLimiter,
  authLimiter,
  registrationLimiter,
  passwordResetLimiter,
  adminLimiter,
  userLimiter,
  speedLimiter,
  uploadLimiter,
  publicLimiter
} = require('./middleware/rateLimiting');

const app = express();

// Configurazione per proxy (necessario per rate limiting in produzione)
// In produzione, fidati solo dei proxy di Render
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Fidati solo del primo proxy (Render)
} else {
  app.set('trust proxy', false); // In sviluppo, non fidarti di proxy per evitare errori di rate limiting
}

// CORS - DEVE essere PRIMO per evitare problemi con OPTIONS
const corsOptions = {
  origin: function (origin, callback) {
    // Lista degli origin consentiti
    const allowedOrigins = [
      'https://www.demos.community',
      'https://demos.community',
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    
    // Permetti richieste senza origin (es. Postman, mobile apps)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log('🚨 CORS: Origin non autorizzato:', origin);
      callback(new Error('Non autorizzato da CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma'],
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// Gestione esplicita delle richieste OPTIONS per CORS
app.options('*', (req, res) => {
  console.log('🔍 CORS OPTIONS richiesta da:', req.headers.origin);
  res.header('Access-Control-Allow-Origin', req.headers.origin || 'https://www.demos.community');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');
  res.header('Access-Control-Allow-Credentials', 'true');
  res.status(200).end();
});

// Middleware CORS aggiuntivo per sicurezza
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log('🌐 Richiesta da origin:', origin);
  
  if (origin && (origin.includes('demos.community') || origin.includes('localhost'))) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  
  next();
});

// DEBUG: Middleware di logging universale per catturare TUTTE le richieste
app.use((req, res, next) => {
  console.log(`🚨 UNIVERSAL LOG: ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
  next();
});

// Middleware di sicurezza
app.use(securityHeaders);
app.use(securityMiddleware);
app.use(securityLogger);

// Middleware di logging centralizzato
app.use(requestLoggingMiddleware);

// Middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// RATE LIMITING - Applica limiti generali DOPO il CORS
app.use(generalLimiter);
app.use(speedLimiter);

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

// Route modulari con rate limiting specifico
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/users', userLimiter, userRoutes);
app.use('/api/opinioni', userLimiter, opinioniRoutes);
app.use('/api/governo', publicLimiter, governoRoutes);
app.use('/api/governo/ministro', publicLimiter, governoMinistroRoutes);
app.use('/api/rappresentanti', publicLimiter, rappresentantiRoutes);
app.use('/api/notifiche', publicLimiter, notificheRoutes);
app.use('/api/test-db', publicLimiter, testDbRoutes);
app.use('/api/eventi', publicLimiter, eventiRoutes);
app.use('/api/grazia', publicLimiter, graziaRoutes);
app.use('/api/amnistia', publicLimiter, amnistiaRoutes);
app.use('/api/capo-stato', publicLimiter, capoStatoRoutes);
app.use('/api/elezioni', publicLimiter, elezioniRoutes);
app.use('/api/elezioni-utente', publicLimiter, elezioniRoutes);
app.use('/api/ice', iceRoutes);
app.use('/api/iniziative-popolari', iniziativePopolariRoutes);
app.use('/api/referendum', referendumRoutes);
app.use('/api/referendum-abrogativi', referendumRoutes);
app.use('/api/comunicazioni', comunicazioniRoutes);
app.use('/api/reazioni-comunicazioni', reazioniComunicazioniRoutes);
app.use('/api/sostenitori', sostenitoriRoutes);
app.use('/api/sostenitori', sostenitoriTotaleRoutes);
app.use('/api/rappresentanti', rappresentantiSostenitoriRoutes);
app.use('/api/candidati', candidatiSostenitoriRoutes);
app.use('/api/sondaggi', sondaggiRoutes);
app.use('/api/segnalazioni', segnalazioniRoutes);
app.use('/api/programma', userLimiter, programmaRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/test', testRoutes);

// Route per diritti GDPR
app.use('/api/user', userLimiter, gdprRightsRoutes);
app.use('/api/user/gdpr-requests', userLimiter, gdprRequestsRoutes);

// Route per download dati
app.use('/api/user/download-data', userLimiter, downloadDataRoutes);

// Route per cancellazione account
app.use('/api/user/delete-account', userLimiter, deleteAccountRoutes);

// Route per impostazioni privacy
app.use('/api/user/privacy-settings', userLimiter, privacySettingsRoutes);

// Route per dashboard audit
app.use('/api/admin/audit-dashboard', adminLimiter, auditDashboardRoutes);

// Route per data retention
app.use('/api/admin/data-retention', adminLimiter, dataRetentionRoutes);

// Route per violazioni e notifiche
app.use('/api/admin/violations', adminLimiter, violationRoutes);

// Route per backup e recovery
app.use('/api/admin/backup', adminLimiter, backupRoutes);

// Route per rate limiting dashboard
app.use('/api/admin/rate-limiting', adminLimiter, rateLimitingRoutes);

// Route per validation dashboard
app.use('/api/admin/validation', adminLimiter, validationRoutes);

// Route per logging centralizzato
app.use('/api/admin/logging', adminLimiter, loggingRoutes);

// Route per monitoraggio performance e salute
app.use('/api/admin/monitoring', adminLimiter, monitoringRoutes);

// Route per pulizia database (temporanea)
app.use('/api/cleanup', cleanupRoutes);
app.use('/api/cleanup', cleanupRateLimitRoutes);

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
  
  // Log dell'errore con il sistema centralizzato
  logger.logError(error, req, {
    globalError: true,
    endpoint: req.originalUrl,
    method: req.method
  }).catch(logError => {
    console.error('❌ Errore logging errore globale:', logError);
  });
  
  res.status(500).json({
    success: false,
    error: 'Errore interno del server',
    message: 'Si è verificato un errore imprevisto'
  });
});

// Avvia sistema di audit logging
auditManager.start();

// Avvia sistema di monitoraggio performance
const performanceMonitor = require('./services/performanceMonitor');
performanceMonitor.start(30000); // 30 secondi

// Avvia job di data retention (solo se abilitato)
if (process.env.ENABLE_DATA_RETENTION === 'true') {
  dataRetentionJob.start();
}

// Avvia job di monitoraggio violazioni (solo se abilitato)
if (process.env.ENABLE_VIOLATION_MONITORING === 'true') {
  violationMonitoringJob.start();
}

// Avvia job di backup automatico (solo se abilitato)
if (process.env.ENABLE_AUTOMATIC_BACKUP === 'true') {
  backupJob.start();
}

module.exports = app;
