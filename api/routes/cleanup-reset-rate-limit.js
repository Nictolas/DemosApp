const express = require('express');
const { Pool } = require('pg');

const router = express.Router();

// Endpoint temporaneo per resettare il rate limiting
router.post('/reset-rate-limit', async (req, res) => {
  try {
    console.log('🧹 Reset rate limiting...');
    
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    // Elimina tutte le violazioni di rate limiting
    const result = await pool.query('DELETE FROM rate_limit_violations');
    
    console.log(`🗑️  Eliminate ${result.rowCount} violazioni di rate limiting`);
    await pool.end();
    
    res.json({
      success: true,
      message: `Eliminate ${result.rowCount} violazioni di rate limiting`,
      deletedRows: result.rowCount
    });
    
  } catch (error) {
    console.error('❌ Errore reset rate limiting:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      message: error.message
    });
  }
});

module.exports = router;
