const express = require('express');
const router = express.Router();
const { pool } = require('../db');

// GET /api/ultima-comunicazione - Recupera l'ultima comunicazione
router.get('/', async (req, res) => {
  try {
    console.log('🔍 GET /api/ultima-comunicazione - Richiesta ultima comunicazione');
    
    // Controlla se la tabella comunicazioni esiste
    const tableExists = await pool.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'comunicazioni'
      );
    `);
    
    console.log('📋 Tabella comunicazioni esiste:', tableExists.rows[0].exists);
    
    if (!tableExists.rows[0].exists) {
      return res.json({
        success: true,
        data: null,
        message: 'Tabella comunicazioni non trovata'
      });
    }
    
    // Recupera l'ultima comunicazione
    const result = await pool.query(
      'SELECT * FROM comunicazioni ORDER BY created_at DESC LIMIT 1'
    );
    
    console.log('📊 Ultima comunicazione trovata:', result.rows.length > 0);
    
    res.json({
      success: true,
      data: result.rows[0] || null
    });
  } catch (error) {
    console.error('❌ Errore nel recupero ultima comunicazione:', error);
    res.status(500).json({
      success: false,
      error: 'Errore interno del server',
      details: error.message
    });
  }
});

module.exports = router;
