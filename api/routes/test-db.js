const express = require('express');
const router = express.Router();
const { pool } = require('../config/db');

// GET /api/test-db - Test connessione database
router.get('/', async (req, res) => {
  try {
    console.log('🔍 Test connessione database...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'Presente' : 'Non presente');
    console.log('DB_HOST:', process.env.DB_HOST);
    console.log('DB_USER:', process.env.DB_USER);
    console.log('DB_DATABASE:', process.env.DB_DATABASE);
    
    const client = await pool.connect();
    console.log('✅ Connessione riuscita!');
    
    const result = await client.query('SELECT NOW() as current_time, version() as db_version');
    console.log('⏰ Ora del database:', result.rows[0].current_time);
    
    client.release();
    
    res.json({
      success: true,
      message: 'Connessione database riuscita',
      data: {
        current_time: result.rows[0].current_time,
        db_version: result.rows[0].db_version,
        database_url_present: !!process.env.DATABASE_URL,
        db_host: process.env.DB_HOST,
        db_user: process.env.DB_USER,
        db_database: process.env.DB_DATABASE
      }
    });
  } catch (error) {
    console.error('❌ Errore connessione:', error.message);
    console.error('Codice errore:', error.code);
    
    res.status(500).json({
      success: false,
      error: 'Errore connessione database',
      details: {
        message: error.message,
        code: error.code,
        database_url_present: !!process.env.DATABASE_URL,
        db_host: process.env.DB_HOST,
        db_user: process.env.DB_USER,
        db_database: process.env.DB_DATABASE
      }
    });
  }
});

module.exports = router;
