require('dotenv').config();
const express = require('express');
require('express-async-errors'); // Cattura errori/rejection da route async e li passa al middleware di errore (evita crash)
const cors = require('cors');
const path = require('path');
const { securityHeaders, securityMiddleware, securityLogger } = require('./middleware/security');
const { requestLoggingMiddleware, errorLoggingMiddleware } = require('./middleware/loggingMiddleware');
const logger = require('./services/centralizedLogger');

// Import moduli con gestione errori
let healthRoutes, databaseRoutes, compatibilityRoutes, testOpinioniRoutes;
let testAddOpinioneRoutes, servicesRoutes, authRoutes, clearTokenRoutes, userRoutes;
let opinioniRoutes, opinioniProposteRoutes, governoRoutes, governoMinistroRoutes;
let rappresentantiRoutes, notificheRoutes, notificheTotaliRoutes, fcmTokensRoutes;

try {
  console.log('ðŸ“¦ Caricamento moduli routes...');
  healthRoutes = require('./routes/health');
  databaseRoutes = require('./routes/database');
  compatibilityRoutes = require('./routes/compatibility');
  testOpinioniRoutes = require('./routes/test-opinioni-endpoints');
  testAddOpinioneRoutes = require('./routes/test-add-opinione');
  servicesRoutes = require('./routes/services');
  authRoutes = require('./routes/auth/index');
  clearTokenRoutes = require('./routes/auth/clear-token');
  userRoutes = require('./routes/users/index');
  opinioniRoutes = require('./routes/opinioni/index');
  opinioniProposteRoutes = require('./routes/opinioni-proposte');
  governoRoutes = require('./routes/governo');
  governoMinistroRoutes = require('./routes/governo-ministro');
  rappresentantiRoutes = require('./routes/rappresentanti');
  notificheRoutes = require('./routes/notifiche');
  notificheTotaliRoutes = require('./routes/notifiche-totali');
  fcmTokensRoutes = require('./routes/fcm-tokens');
  console.log('âœ… Moduli routes base caricati correttamente');
} catch (error) {
  console.error('âŒ Errore nel caricamento dei moduli routes base:', error);
  console.error('âŒ Stack trace:', error.stack);
  throw error;
}
const testDbRoutes = require('./routes/test-db');
const eventiRoutes = require('./routes/eventi');
const graziaRoutes = require('./routes/grazia');
const amnistiaRoutes = require('./routes/amnistia');
const capoStatoRoutes = require('./routes/capo-stato');
const elezioniRoutes = require('./routes/elezioni');
const iceRoutes = require('./routes/ice');
const eciRoutes = require('./routes/eci');
const iniziativePopolariRoutes = require('./routes/iniziative-popolari');
const referendumAbrogativiRoutes = require('./routes/referendum-abrogativi');
const referendumRoutes = require('./routes/referendum');
const comunicazioniRoutes = require('./routes/comunicazioni');
const informaCittadiniRoutes = require('./routes/informa-cittadini');
const podioTrasparenzaRoutes = require('./routes/podio-trasparenza');
const avvistamentiRoutes = require('./routes/avvistamenti');
const reazioniComunicazioniRoutes = require('./routes/reazioni-comunicazioni');
const sostenitoriRoutes = require('./routes/sostenitori');
const sostenitoriTotaleRoutes = require('./routes/sostenitori-totale');
const rappresentantiSostenitoriRoutes = require('./routes/rappresentanti-sostenitori');
const candidatiSostenitoriRoutes = require('./routes/candidati-sostenitori');
const attivistiSostenitoriRoutes = require('./routes/attivisti-sostenitori');
const migrateRoutes = require('./routes/migrate-columns');
const sondaggiRoutes = require('./routes/sondaggi');
const adminRoutes = require('./routes/admin/database');
const candidatiRoutes = require('./routes/candidati');
const fixDatabaseRoutes = require('./routes/fix-database');
const debugOpinioniRoutes = require('./routes/debug-opinioni');
const attivistiRoutes = require('./routes/attivisti');
const organizzazioniRoutes = require('./routes/organizzazioni');
const organizzazioniSostenitoriRoutes = require('./routes/organizzazioni-sostenitori');
const attivismoTipologieRoutes = require('./routes/attivismo-tipologie');
const gdprRightsRoutes = require('./routes/user/gdpr-rights');
const politicalOpinionsConsentRoutes = require('./routes/user/political-opinions-consent');
const registrationConsentsRoutes = require('./routes/user/registration-consents');
const gdprRequestsRoutes = require('./routes/user/gdpr-requests');
const downloadDataRoutes = require('./routes/user/download-data');
const deleteAccountRoutes = require('./routes/user/delete-account');
const privacySettingsRoutes = require('./routes/user/privacy-settings');
const auditDashboardRoutes = require('./routes/admin/audit-dashboard');
const dpoOverviewRoutes = require('./routes/dpo/overview');
const dataRetentionRoutes = require('./routes/admin/data-retention');
const violationRoutes = require('./routes/admin/violations');
const backupRoutes = require('./routes/admin/backup');
const rateLimitingRoutes = require('./routes/admin/rate-limiting');
const validationRoutes = require('./routes/admin/validation');
const loggingRoutes = require('./routes/admin/logging');
const monitoringRoutes = require('./routes/admin/monitoring');
const securityMetricsRoutes = require('./routes/admin/security-metrics');
const dataExportRoutes = require('./routes/admin/data-export');
const civicProcessReconciliationRoutes = require('./routes/admin/civic-process-reconciliation');
const civicProcessAdminRoutes = require('./routes/admin/civic-processes');
const axiomMigrationRoutes = require('./routes/admin/axiom-migration');
const axiomDataRoutes = require('./routes/admin/axiom-data');
const migrationsRoutes = require('./routes/migrations');
const cleanupRoutes = require('./routes/cleanup');
const cleanupRateLimitRoutes = require('./routes/cleanup-reset-rate-limit');
const testRateLimitRoutes = require('./routes/test-rate-limit');
const segnalazioniRoutes = require('./routes/segnalazioni');
const programmaRoutes = require('./routes/programma');
const riconoscimentiRoutes = require('./routes/riconoscimenti');
const testPerformanceRoutes = require('./routes/test-performance');
const statisticheRoutes = require('./routes/statistiche');
const ministeroRoutes = require('./routes/ministero');
const votiPoliticiRoutes = require('./routes/voti-politici');
const votiCameraRoutes = require('./routes/voti-camera');
const votiParlamentoEuropeoRoutes = require('./routes/voti-parlamento-europeo');
const bachecaRoutes = require('./routes/bacheca');
// const testMiddlewareRoutes = require('./routes/test-middleware');
// const testSimpleRoutes = require('./routes/test-simple');
// const { startAuditJobs } = require('./jobs/auditCleanup'); // Disabilitato per il deploy
const auditManager = require('./services/auditManager');
const dataRetentionJob = require('./jobs/dataRetentionJob');
const violationMonitoringJob = require('./jobs/violationMonitoringJob');
const backupJob = require('./jobs/backupJob');
const ministeroSyncJob = require('./jobs/ministeroSyncJob');
const civicProcessSyncJob = require('./jobs/civicProcessSyncJob');
const politicalTerritoryResolverJob = require('./jobs/politicalTerritoryResolverJob');
const italianElectionUnitSyncJob = require('./jobs/italianElectionUnitSyncJob');
const { startVotiParlamentoSyncJob } = require('./jobs/votiParlamentoSyncJob');
const { startOpenpolisCosaSuccedeJob } = require('./jobs/openpolisCosaSuccedeJob');
const { startOpenpolisVotazioniFinaliJob } = require('./jobs/openpolisVotazioniFinaliJob');

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

/** In produzione le route test/migrate/cleanup/debug non sono montate salvo ALLOW_DEV_API_SURFACE=true */
const isProductionApp = process.env.NODE_ENV === 'production';
const mountDevApiSurface = !isProductionApp || process.env.ALLOW_DEV_API_SURFACE === 'true';

const app = express();
const { privacyRecoveryMaintenance } = require('./middleware/privacyRecoveryMaintenance');
// Must run before CORS OPTIONS and every API handler during GDPR recovery.
app.use(privacyRecoveryMaintenance);

// Configurazione per proxy (necessario per rate limiting in produzione)
// In produzione, fidati solo dei proxy di Render
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1); // Fidati solo del primo proxy (Render)
} else {
  app.set('trust proxy', false); // In sviluppo, non fidarti di proxy per evitare errori di rate limiting
}

// CORS - Configurazione semplificata e robusta
const corsOptions = {
  origin: function (origin, callback) {
    // Lista degli origin consentiti
    const allowedOrigins = [
      'https://www.demos.community',
      'https://demos.community',
      'https://demos-c7k0.onrender.com', // Backend Render (per form HTML del mock CIE)
      'https://demos-frontend-r3so.onrender.com', // Frontend Render di DEMOS
      'http://localhost:3000',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:5173'
    ];
    
    // Permetti richieste senza origin (es. Postman, mobile apps)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      console.log('âœ… CORS: Origin autorizzato:', origin);
      callback(null, true);
    } else {
      console.log('ðŸš¨ CORS: Origin non autorizzato:', origin);
      callback(new Error('Non autorizzato da CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'Cache-Control', 'Pragma'],
  optionsSuccessStatus: 200
};

// Middleware CORS aggiuntivo per garantire che gli header siano sempre impostati
app.use((req, res, next) => {
  const origin = req.headers.origin;
  console.log('ðŸŒ CORS Middleware - Origin:', origin);
  
  // Lista degli origin consentiti
  const allowedOrigins = [
    'https://www.demos.community',
    'https://demos.community',
    'https://demos-c7k0.onrender.com', // Backend Render (per form HTML del mock CIE)
    'https://demos-frontend-r3so.onrender.com', // Frontend Render di DEMOS
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');
    console.log('âœ… CORS: Header impostati per origin:', origin);
  } else if (origin) {
    console.log('ðŸš¨ CORS: Origin non autorizzato:', origin);
  }
  
  next();
});

// Gestione esplicita delle richieste OPTIONS per CORS
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  console.log('ðŸ” CORS OPTIONS richiesta da:', origin);
  
  // Lista degli origin consentiti
  const allowedOrigins = [
    'https://www.demos.community',
    'https://demos.community',
    'https://demos-c7k0.onrender.com', // Backend Render (per form HTML del mock CIE)
    'https://demos-frontend-r3so.onrender.com', // Frontend Render di DEMOS
    'http://localhost:3000',
    'http://localhost:5173',
    'http://127.0.0.1:3000',
    'http://127.0.0.1:5173'
  ];
  
  if (origin && allowedOrigins.includes(origin)) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept, Origin, Cache-Control, Pragma');
    console.log('âœ… CORS OPTIONS: Header impostati per origin:', origin);
  } else if (origin) {
    console.log('ðŸš¨ CORS OPTIONS: Origin non autorizzato:', origin);
  }
  
  res.status(200).end();
});

app.use(cors(corsOptions));

// DEBUG: Middleware di logging universale - solo in sviluppo (evita accumulo log in produzione)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`ðŸš¨ UNIVERSAL LOG: ${req.method} ${req.originalUrl} - ${new Date().toISOString()}`);
    if (req.originalUrl.includes('send-demos-notification')) {
      console.log(`ðŸ”´ ========== UNIVERSAL LOG: RICHIESTA send-demos-notification ==========`);
      console.log(`ðŸ”´ Method: ${req.method}`);
      console.log(`ðŸ”´ URL: ${req.originalUrl}`);
      console.log(`ðŸ”´ Path: ${req.path}`);
      console.log(`ðŸ”´ Headers: ${JSON.stringify(req.headers)}`);
    }
    if (req.originalUrl.includes('send-user-notification')) {
      console.log(`ðŸŸ£ ========== UNIVERSAL LOG: RICHIESTA send-user-notification ==========`);
      console.log(`ðŸŸ£ Method: ${req.method}`);
      console.log(`ðŸŸ£ URL: ${req.originalUrl}`);
      console.log(`ðŸŸ£ Path: ${req.path}`);
      console.log(`ðŸŸ£ Base URL: ${req.baseUrl}`);
      console.log(`ðŸŸ£ Headers Authorization: ${req.headers.authorization ? 'Presente' : 'Mancante'}`);
      console.log(`ðŸŸ£ Body keys: ${req.body && typeof req.body === 'object' ? Object.keys(req.body).join(',') : 'none'}`);
    }
    next();
  });
}

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


// Logging middleware di debug - solo in sviluppo (evita accumulo log in produzione)
if (process.env.NODE_ENV !== 'production') {
  app.use((req, res, next) => {
    console.log(`ðŸ“¡ ${req.method} ${req.path} - ${new Date().toISOString()}`);
    console.log(`ðŸŒ Origin: ${req.headers.origin || 'Nessuna'}`);
    console.log(`ðŸ”— Referer: ${req.headers.referer || 'Nessuna'}`);
    if (req.path === '/api/auth/register' && req.method === 'POST') {
      console.log('ðŸš¨ DEBUG: Richiesta POST /api/auth/register rilevata!');
      console.log('ðŸš¨ DEBUG: Headers:', req.headers);
      console.log('ðŸš¨ DEBUG: Body size:', req.body ? Object.keys(req.body).length : 'Nessun body');
    }
    if (req.path.startsWith('/api/auth/') && req.method === 'POST') {
      console.log('ðŸ” DEBUG: Richiesta POST a /api/auth/* rilevata:', req.path);
      console.log('ðŸ” DEBUG: Body presente:', !!req.body);
      console.log('ðŸ” DEBUG: Content-Type:', req.headers['content-type']);
    }
    if (req.path === '/api/auth/login' || req.path === '/auth/login') {
      console.log('ðŸ” LOGIN REQUEST DETECTED:', req.method, req.path);
    }
    if (req.path === '/api/referendum-abrogativi' && req.method === 'POST') {
      console.log('ðŸ“‹ REFERENDUM POST REQUEST DETECTED:', req.method, req.path);
      console.log('ðŸ“‹ REFERENDUM POST - Authorization header:', req.headers.authorization ? 'Presente' : 'Mancante');
      console.log('ðŸ“‹ REFERENDUM POST - Body keys:', req.body && typeof req.body === 'object' ? Object.keys(req.body) : []);
    }
    next();
  });
}

// Route di base
app.use('/api', healthRoutes);

// Route per database
app.use('/api', databaseRoutes);

// Route per compatibilitÃ  frontend
app.use('/api', compatibilityRoutes);

// Route per servizi
app.use('/api', servicesRoutes);

// Route di test (non in produzione senza ALLOW_DEV_API_SURFACE)
if (mountDevApiSurface) {
  app.use('/api/test-opinioni-endpoints', testOpinioniRoutes);
  app.use('/api/test-add-opinione', testAddOpinioneRoutes);
}

// Route modulari con rate limiting specifico
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/auth', clearTokenRoutes);
app.use('/api/users', userLimiter, userRoutes);
app.use('/api/opinioni', userLimiter, opinioniRoutes);
app.use('/api/opinioni-proposte', publicLimiter, opinioniProposteRoutes);
// Applica userLimiter per richieste autenticate, publicLimiter per quelle non autenticate
// Il publicLimiter salta automaticamente le richieste con token Bearer
app.use('/api/governo', publicLimiter, userLimiter, governoRoutes);
app.use('/api/governo/ministro', publicLimiter, userLimiter, governoMinistroRoutes);
app.use('/api/rappresentanti', publicLimiter, userLimiter, rappresentantiRoutes);
app.use('/api/notifiche', publicLimiter, userLimiter, notificheRoutes);
app.use('/api/notifiche-totali', userLimiter, notificheTotaliRoutes);
app.use('/api/fcm-tokens', userLimiter, fcmTokensRoutes);
if (mountDevApiSurface) {
  app.use('/api/test-db', publicLimiter, testDbRoutes);
}
app.use('/api/eventi', publicLimiter, eventiRoutes);
app.use('/api/grazia', publicLimiter, graziaRoutes);
app.use('/api/amnistia', publicLimiter, amnistiaRoutes);
app.use('/api/capo-stato', publicLimiter, capoStatoRoutes);
app.use('/api/elezioni', publicLimiter, elezioniRoutes);
app.use('/api/elezioni-utente', publicLimiter, elezioniRoutes);
app.use('/api/ice', iceRoutes);
app.use('/api/eci', eciRoutes);
app.use('/api/iniziative-popolari', iniziativePopolariRoutes);
app.use('/api/referendum-abrogativi', referendumAbrogativiRoutes);
app.use('/api/referendum', referendumRoutes);
app.use('/api/comunicazioni', comunicazioniRoutes);
app.use('/api/informa-cittadini', informaCittadiniRoutes);
app.use('/api/podio-trasparenza', userLimiter, podioTrasparenzaRoutes);
app.use('/api/avvistamenti', avvistamentiRoutes);
app.use('/api/reazioni-comunicazioni', reazioniComunicazioniRoutes);
app.use('/api/sostenitori', sostenitoriRoutes);
app.use('/api/sostenitori', sostenitoriTotaleRoutes);
app.use('/api/rappresentanti', rappresentantiSostenitoriRoutes);
app.use('/api/candidati', candidatiSostenitoriRoutes);
app.use('/api/attivisti', attivistiSostenitoriRoutes);
app.use('/api/organizzazioni', organizzazioniSostenitoriRoutes);
if (mountDevApiSurface) {
  app.use('/api/migrate', migrateRoutes);
}
app.use('/api/sondaggi', sondaggiRoutes);
app.use('/api/segnalazioni', segnalazioniRoutes);
app.use('/api/programma', userLimiter, programmaRoutes);
if (mountDevApiSurface) {
  app.use('/api/test-performance', testPerformanceRoutes);
}
app.use('/api/statistiche', publicLimiter, statisticheRoutes);
app.use('/api/ministero', publicLimiter, ministeroRoutes);
app.use('/api/voti-politici', userLimiter, votiPoliticiRoutes);
app.use('/api/voti-parlamento-europeo', userLimiter, votiParlamentoEuropeoRoutes);
app.use('/api/voti-camera', userLimiter, votiCameraRoutes);
app.use('/api/bacheca', userLimiter, bachecaRoutes);
// app.use('/api/test', testMiddlewareRoutes);
// app.use('/api/test', testSimpleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/candidati', candidatiRoutes);
if (mountDevApiSurface) {
  app.use('/api/fix-database', fixDatabaseRoutes);
  app.use('/api/debug-opinioni', debugOpinioniRoutes);
}
app.use('/api/attivisti', attivistiRoutes);
app.use('/api/organizzazioni', organizzazioniRoutes);
app.use('/api/attivismo-tipologie', attivismoTipologieRoutes);
app.use('/api/riconoscimenti', userLimiter, riconoscimentiRoutes);

// Route per diritti GDPR
app.use('/api/user', userLimiter, gdprRightsRoutes);
app.use('/api/user/gdpr-requests', userLimiter, gdprRequestsRoutes);

// Route per download dati
app.use('/api/user/download-data', userLimiter, downloadDataRoutes);

// Route per cancellazione account
app.use('/api/user/delete-account', userLimiter, deleteAccountRoutes);

// Route per impostazioni privacy
app.use('/api/user/privacy-settings', userLimiter, privacySettingsRoutes);

// Route per consenso opinioni politiche (GDPR Art. 9)
app.use('/api/user/political-opinions-consent', userLimiter, politicalOpinionsConsentRoutes);
// Route per consensi dati in fase di registrazione (privacy + termini)
app.use('/api/user/registration-consents', userLimiter, registrationConsentsRoutes);

// Route per dashboard audit
// DPO: separate, explicitly authorized read-only privacy oversight.
app.use('/api/dpo', userLimiter, dpoOverviewRoutes);
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

// Route per export dati
app.use('/api/admin/data-export', adminLimiter, dataExportRoutes);

// IMP-029: revisione manuale dei candidati di riconciliazione multi-fonte.
app.use('/api/admin/civic-process-reconciliation', adminLimiter, civicProcessReconciliationRoutes);
app.use('/api/admin/civic-processes', adminLimiter, civicProcessAdminRoutes);

// Route per migrazione Axiom
app.use('/api/admin/axiom-migration', adminLimiter, axiomMigrationRoutes);

// Route per dati Axiom (tabella)
app.use('/api/admin/axiom-data', adminLimiter, axiomDataRoutes);

// Route per monitoraggio performance e salute
app.use('/api/admin/monitoring', adminLimiter, monitoringRoutes);
app.use('/api/admin/security', adminLimiter, securityMetricsRoutes);

// Security Center AI/security read-only: OFF by default and mountable only behind the staging-isolation gate.
if (process.env.SECURITY_CENTER_RUNTIME_ENABLED === 'true') {
  let verifyToken;
  let requireAdmin;
  if (process.env.SECURITY_CENTER_STAGING_AUTH_ENABLED === 'true') {
    const { createSecurityCenterStagingAuth } = require('./security-agent/securityCenterStagingAuth');
    ({ verifyToken, requireAdmin } = createSecurityCenterStagingAuth(process.env));
  } else {
    ({ verifyToken, requireAdmin } = require('./middleware/auth'));
  }
  const { mountSecurityCenterRuntime } = require('./security-agent/securityCenterMount');
  mountSecurityCenterRuntime({
    app,
    env: process.env,
    verifyToken,
    requireAdmin,
    adminLimiter
  });
}

// Route per migrazioni database / cleanup / test (non in produzione senza ALLOW_DEV_API_SURFACE)
if (mountDevApiSurface) {
  app.use('/api/migrations', migrationsRoutes);
  app.use('/api/cleanup', cleanupRoutes);
  app.use('/api/cleanup', cleanupRateLimitRoutes);
  app.use('/api/test', testRateLimitRoutes);
}

if (isProductionApp && !mountDevApiSurface) {
  console.log(
    'ðŸ”’ Route API dev/test/migrate/cleanup non esposte. Per abilitarle: ALLOW_DEV_API_SURFACE=true'
  );
}

// Gestione errori 404
app.use('*', (req, res) => {
  console.log(`âŒ Route non trovata: ${req.method} ${req.originalUrl}`);
  res.status(404).json({
    success: false,
    error: 'Route non trovata',
    message: `La route ${req.method} ${req.originalUrl} non esiste`
  });
});

// Middleware gestione errori globale (riceve errori da route async grazie a express-async-errors)
app.use((error, req, res, next) => {
  console.error('ðŸ’¥ Errore globale:', error);
  if (error && error.stack) console.error('ðŸ’¥ Stack:', error.stack);

  logger.logError(error, req, {
    globalError: true,
    endpoint: req.originalUrl,
    method: req.method
  }).catch(logError => {
    console.error('âŒ Errore logging errore globale:', logError);
  });

  if (!res.headersSent) {
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Si Ã¨ verificato un errore imprevisto'
    });
  }
});

// Recovery maintenance must also suppress application-owned periodic jobs.
// This is not a substitute for pausing other Render workers or provider APIs.
if (process.env.DEMOS_PRIVACY_RECOVERY_MAINTENANCE !== 'true') {
// Avvia sistema di audit logging
auditManager.start();

// Avvia sistema di monitoraggio performance
const performanceMonitor = require('./services/performanceMonitor');
const performanceMonitorEnabled = process.env.PERFORMANCE_MONITOR_ENABLED !== 'false';
const defaultPerformanceMonitorIntervalMs = process.env.NODE_ENV === 'production' ? 120000 : 30000;
const performanceMonitorIntervalMs = Math.max(
  15000,
  parseInt(process.env.PERFORMANCE_MONITOR_INTERVAL_MS || String(defaultPerformanceMonitorIntervalMs), 10)
);
if (performanceMonitorEnabled) {
  performanceMonitor.start(performanceMonitorIntervalMs);
} else {
  console.log('ðŸ“Š Performance monitoring disabilitato (PERFORMANCE_MONITOR_ENABLED=false)');
}

// Avvia sistema di ottimizzazione performance
const performanceOptimizer = require('./services/performanceOptimizer');
performanceOptimizer.start();

/**
 * Job in background e impatto su Supabase (connessioni, query ripetute):
 * - Data retention / violation: intervalli ms via DATA_RETENTION_*_INTERVAL_MS, VIOLATION_*_INTERVAL_MS
 * - Backup: ore da BackupService (config)
 * - Ministero: MINISTERO_SYNC_INTERVAL_MS, MINISTERO_SYNC_IN_CORSO_INTERVAL_MS (vedi ministeroSyncJob.js)
 * - Processi civici canonici: CIVIC_PROCESS_SYNC_INTERVAL_MS (default 6h), solo con ENABLE_CIVIC_PROCESS_SYNC=true
 * - Resolver territori politici: POLITICAL_TERRITORY_RESOLVER_INTERVAL_MS (default 6h), solo con ENABLE_POLITICAL_TERRITORY_RESOLVER=true
 * - Voti parlamento: cron VOTI_PARLAMENTO_SYNC_CRON (default 6h)
 * - Openpolis: OPENPOLIS_COSA_SUCCEDE_CRON, OPENPOLIS_VOTAZIONI_FINALI_CRON (default offset rispetto allâ€™ora)
 * Raggruppare sync meno frequenti o allineare le finestre riduce wake ripetuti del DB.
 */
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
  console.warn(
    'Legacy application JSON backup is retired and will not start. Use PostgreSQL/provider recovery (Neon PITR in production).'
  );
}

// Avvia job di sincronizzazione Ministero (solo se esplicitamente abilitato)
// Se ENABLE_MINISTERO_SYNC non Ã¨ presente (undefined) oppure non Ã¨ "true", il job resta disabilitato.
if (process.env.ENABLE_MINISTERO_SYNC === 'true') {
  ministeroSyncJob.start();
}

// Alimenta il modello canonico multi-fonte solo dopo migrazione esplicita dell'ambiente.
// Il flag resta opt-in: nessun ambiente esistente cambia comportamento automaticamente.
if (process.env.ENABLE_CIVIC_PROCESS_SYNC === 'true') {
  civicProcessSyncJob.start();
}

// Normalizza la residenza italiana contro lo snapshot ufficiale SITUAS solo dopo
// l'installazione esplicita dello schema territoriale canonico. Opt-in per default.
if (process.env.ENABLE_POLITICAL_TERRITORY_RESOLVER === 'true') {
  politicalTerritoryResolverJob.start();
}

// Importa unità elettorali ufficiali DAIT per una consultazione/evento esplicitamente configurati.
// One-shot e opt-in: nessun evento viene associato automaticamente a una fonte ministeriale.
if (process.env.ENABLE_ITALIAN_ELECTION_UNIT_SYNC === 'true') {
  italianElectionUnitSyncJob.start();
}

// Avvia job di sincronizzazione votazioni parlamentari (solo se esplicitamente abilitato)
if (process.env.ENABLE_VOTI_PARLAMENTO_SYNC === 'true') {
  startVotiParlamentoSyncJob();
}

// Avvia job Openpolis "Cosa succede" (ultimi DDL approvati per titoli descrittivi)
// (include anche i job Openpolis votazioni finali) - solo se esplicitamente abilitato.
if (process.env.ENABLE_OPENPOLIS_COSA_SUCCEDE_SYNC === 'true') {
  startOpenpolisCosaSuccedeJob();
  // Esegui un sync iniziale in background cosÃ¬ la prima richiesta ha giÃ  i titoli
  const { runOpenpolisCosaSuccedeSync } = require('./jobs/openpolisCosaSuccedeJob');
  setImmediate(() => runOpenpolisCosaSuccedeSync().catch(() => {}));

  startOpenpolisVotazioniFinaliJob();
  const { runOpenpolisVotazioniFinaliSync } = require('./jobs/openpolisVotazioniFinaliJob');
  setImmediate(() => runOpenpolisVotazioniFinaliSync().catch(() => {}));
}


// Axiom -> Backblaze B2 historical archive (fail-closed, disabled by default).
// No query or upload occurs unless AXIOM_ARCHIVE_ENABLED is exactly "true".
if (process.env.AXIOM_ARCHIVE_ENABLED === 'true') {
  const axiomArchiveJob = require('./jobs/axiomArchiveJob');
  axiomArchiveJob.start();
}

} else {
  console.warn('GDPR recovery maintenance: HTTP blocked and app-owned background jobs disabled');
}

module.exports = app;
