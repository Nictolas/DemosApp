const express = require('express');
const { getPool } = require('../config/database');

const router = express.Router();

// Database diagnostics must be explicitly opted into on local development only.
// A production ALLOW_DEV_API_SURFACE override must never expose SQL metadata.
const enableDbDiagnostics = process.env.NODE_ENV === 'development' &&
  process.env.ALLOW_DB_DIAGNOSTICS === 'true';


// Route di base e health check
router.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Demos Community API',
    version: '2.0.0',
    status: 'Operativa',
    timestamp: new Date().toISOString()
  });
});

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'API operativa',
    timestamp: new Date().toISOString(),
    // Public liveness must not reveal runtime memory or deployment configuration.
    // Detailed diagnostics belong in authenticated, explicitly enabled tooling.
    status: 'ok'
  });
});

// Endpoint per testare la connessione al database
if (enableDbDiagnostics) {
router.get('/test-db', async (req, res) => {
  try {
    console.log('🧪 Test connessione database...');
    console.log('🌍 Ambiente:', process.env.NODE_ENV);
    console.log('🔗 DATABASE_URL presente:', !!process.env.DATABASE_URL);
    
    if (!process.env.DATABASE_URL) {
      return res.status(500).json({
        success: false,
        error: 'DATABASE_URL mancante',
        message: 'Variabile d\'ambiente non configurata'
      });
    }

    const pool = getPool();
    const client = await pool.connect();
    console.log('✅ Connessione database riuscita!');
    
    // Test query semplice
    const result = await client.query('SELECT NOW() as current_time');
    console.log('📊 Query test riuscita:', result.rows[0]);
    
    client.release();

    res.json({
      success: true,
      message: 'Connessione database OK',
      timestamp: new Date().toISOString(),
      dbTime: result.rows[0].current_time,
      environment: process.env.NODE_ENV
    });

  } catch (error) {
    console.error('💥 Errore test database:', error);
    res.status(500).json({
      success: false,
      error: 'Errore connessione database',
      message: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

}

module.exports = router;
