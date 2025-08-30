const express = require('express');
const rateLimit = require('express-rate-limit');
const { corsMiddleware, corsPreflight } = require('./middleware/cors');

// Inizializzazione app Express
const app = express();

// Configurazione middleware di base
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Configurazione CORS
app.use(corsMiddleware);
app.use(corsPreflight);

// Rate limiting per prevenire abusi
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minuti
  max: 100, // limite di 100 richieste per finestra
  message: {
    success: false,
    error: 'Troppe richieste, riprova più tardi'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// Applica rate limiting a tutte le route
app.use(limiter);

// Importazione delle route modulari
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const rappresentantiRoutes = require('./routes/rappresentanti');
const opinioniRoutes = require('./routes/opinioni');
const elezioniRoutes = require('./routes/elezioni');
const sondaggiRoutes = require('./routes/sondaggi');
const graziaRoutes = require('./routes/grazia');
const amnistiaRoutes = require('./routes/amnistia');
const iceRoutes = require('./routes/ice');
const referendumRoutes = require('./routes/referendum');

// Registrazione delle route
app.use('/api/auth', authRoutes);
app.use('/api/utenti', userRoutes);
app.use('/api/rappresentanti', rappresentantiRoutes);
app.use('/api/opinioni', opinioniRoutes);
app.use('/api/elezioni', elezioniRoutes);
app.use('/api/sondaggi', sondaggiRoutes);
app.use('/api/grazia', graziaRoutes);
app.use('/api/amnistia', amnistiaRoutes);
app.use('/api/ice', iceRoutes);
app.use('/api/referendum', referendumRoutes);

// Route di base e health check
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Demos Community API',
    version: '2.0.0',
    status: 'Operativa',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'API operativa',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: process.memoryUsage(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Endpoint per controllare se un'email esiste già
app.post('/api/check-email', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email richiesta',
        message: 'Il campo email è obbligatorio'
      });
    }

    console.log('🔍 Controllo email nel database:', email);

    // Importa la configurazione del database
    const { Pool } = require('pg');
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Controlla se l'email esiste nella tabella users
    const result = await pool.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    const exists = result.rows.length > 0;
    console.log('📊 Email trovata nel database:', exists, 'Righe:', result.rows.length);

    // Chiudi la connessione
    await pool.end();

    res.json({ exists });

  } catch (error) {
    console.error('💥 Errore durante il controllo email:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: 'Impossibile verificare l\'email'
    });
  }
});

// Endpoint di test per Resend
app.post('/api/test-resend-email', async (req, res) => {
  try {
    const { testResend } = require('./services/emailService');
    const result = await testResend();
    res.json(result);
  } catch (error) {
    console.error('❌ Errore nel test Resend:', error);
    res.status(500).json({
      success: false,
      error: 'Errore nel test Resend',
      message: error.message
    });
  }
});

// Gestione errori 404
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint non trovato',
    message: `La route ${req.originalUrl} non esiste`
  });
});

// Middleware per gestire errori globali
app.use((error, req, res, next) => {
  console.error('❌ Errore globale:', error);
  
  res.status(error.status || 500).json({
    success: false,
    error: 'Errore interno del server',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Si è verificato un errore interno'
  });
});

module.exports = app;
